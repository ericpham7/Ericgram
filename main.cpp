#include "include/httplib.h"
#include <algorithm>
#include <atomic>
#include <cctype>
#include <chrono>
#include <condition_variable>
#include <cstdlib>
#include <cstdio>
#include <ctime>
#include <functional>
#include <iomanip>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <random>
#include <regex>
#include <set>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/rand.h>
#include <openssl/sha.h>

using namespace std;

static const size_t MEDIA_BYTES_CAP = 512ULL * 1024ULL * 1024ULL;
static const int MAX_CAPTION_LENGTH = 2200;
static const int MAX_COMMENT_LENGTH = 500;
static const int MAX_MEDIA_FILES_PER_POST = 4;
static const int SESSION_TTL_SECONDS = 12 * 60 * 60;
static const int FEED_DEFAULT_LIMIT = 20;
static const int FEED_MAX_LIMIT = 50;

string jsonEscape(const string &value) {
  string out;
  out.reserve(value.size() + 16);
  for (unsigned char c : value) {
    switch (c) {
    case '"':
      out += "\\\"";
      break;
    case '\\':
      out += "\\\\";
      break;
    case '\b':
      out += "\\b";
      break;
    case '\f':
      out += "\\f";
      break;
    case '\n':
      out += "\\n";
      break;
    case '\r':
      out += "\\r";
      break;
    case '\t':
      out += "\\t";
      break;
    default:
      if (c < 0x20) {
        char buffer[7];
        snprintf(buffer, sizeof(buffer), "\\u%04x", c);
        out += buffer;
      } else {
        out += static_cast<char>(c);
      }
      break;
    }
  }
  return out;
}

string toLowerCopy(string text) {
  transform(text.begin(), text.end(), text.begin(),
            [](unsigned char c) { return static_cast<char>(tolower(c)); });
  return text;
}

bool containsCaseInsensitive(const string &text, const string &queryLower) {
  if (queryLower.empty()) {
    return true;
  }
  return toLowerCopy(text).find(queryLower) != string::npos;
}

string trimCopy(const string &value) {
  size_t start = 0;
  while (start < value.size() &&
         isspace(static_cast<unsigned char>(value[start]))) {
    start++;
  }

  if (start == value.size()) {
    return "";
  }

  size_t end = value.size() - 1;
  while (end > start && isspace(static_cast<unsigned char>(value[end]))) {
    end--;
  }

  return value.substr(start, end - start + 1);
}

string boolToJSON(bool value) { return value ? "true" : "false"; }

string getCurrentUtcIsoTimestamp() {
  time_t now = time(nullptr);
  tm *utc = gmtime(&now);
  if (!utc) {
    return "1970-01-01T00:00:00Z";
  }

  char buffer[32];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", utc);
  return string(buffer);
}

int parsePositiveIntOrDefault(const string &raw, int fallback) {
  if (raw.empty()) {
    return fallback;
  }

  try {
    int parsed = stoi(raw);
    return parsed > 0 ? parsed : fallback;
  } catch (...) {
    return fallback;
  }
}

void setJsonError(httplib::Response &res, int status, const string &message) {
  res.status = status;
  res.set_content("{\"error\":\"" + jsonEscape(message) + "\"}",
                  "application/json");
}

string getEnvOrDefault(const string &key, const string &fallback) {
  const char *value = getenv(key.c_str());
  if (!value) {
    return fallback;
  }
  return string(value);
}

bool getEnvBool(const string &key, bool fallback) {
  string raw = toLowerCopy(trimCopy(getEnvOrDefault(key, "")));
  if (raw.empty()) {
    return fallback;
  }
  return raw == "1" || raw == "true" || raw == "yes" || raw == "on";
}

long long nowUnixSeconds() {
  return static_cast<long long>(time(nullptr));
}

string toHex(const unsigned char *data, size_t length) {
  static const char *digits = "0123456789abcdef";
  string out;
  out.reserve(length * 2);
  for (size_t i = 0; i < length; i++) {
    unsigned char b = data[i];
    out.push_back(digits[b >> 4]);
    out.push_back(digits[b & 0x0F]);
  }
  return out;
}

vector<unsigned char> fromHex(const string &hex) {
  vector<unsigned char> out;
  if (hex.size() % 2 != 0) {
    return out;
  }
  out.reserve(hex.size() / 2);
  auto hexVal = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
    if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
    return -1;
  };

  for (size_t i = 0; i < hex.size(); i += 2) {
    int high = hexVal(hex[i]);
    int low = hexVal(hex[i + 1]);
    if (high < 0 || low < 0) {
      out.clear();
      return out;
    }
    out.push_back(static_cast<unsigned char>((high << 4) | low));
  }
  return out;
}

string sha256Hex(const string &value) {
  unsigned char digest[SHA256_DIGEST_LENGTH];
  SHA256(reinterpret_cast<const unsigned char *>(value.data()), value.size(),
         digest);
  return toHex(digest, SHA256_DIGEST_LENGTH);
}

vector<unsigned char> hmacSha256(const vector<unsigned char> &key,
                                 const string &data) {
  unsigned int len = SHA256_DIGEST_LENGTH;
  unsigned char out[SHA256_DIGEST_LENGTH];
  HMAC(EVP_sha256(), key.data(), static_cast<int>(key.size()),
       reinterpret_cast<const unsigned char *>(data.data()), data.size(), out,
       &len);
  return vector<unsigned char>(out, out + len);
}

vector<unsigned char> hmacSha256(const string &key, const string &data) {
  vector<unsigned char> keyVec(key.begin(), key.end());
  return hmacSha256(keyVec, data);
}

vector<string> splitBy(const string &text, char delimiter) {
  vector<string> out;
  string current;
  for (char c : text) {
    if (c == delimiter) {
      out.push_back(current);
      current.clear();
    } else {
      current.push_back(c);
    }
  }
  out.push_back(current);
  return out;
}

vector<string> splitCSV(const string &text) {
  vector<string> out;
  for (const auto &part : splitBy(text, ',')) {
    string trimmed = trimCopy(part);
    if (!trimmed.empty()) {
      out.push_back(trimmed);
    }
  }
  return out;
}

string toLowerAlnum(const string &value) {
  string out;
  out.reserve(value.size());
  for (unsigned char c : value) {
    if (isalnum(c)) {
      out.push_back(static_cast<char>(tolower(c)));
    }
  }
  return out;
}

string randomHex(size_t bytes) {
  vector<unsigned char> buffer(bytes, 0);
  if (RAND_bytes(buffer.data(), static_cast<int>(buffer.size())) != 1) {
    static thread_local mt19937 rng(static_cast<unsigned int>(time(nullptr)));
    uniform_int_distribution<int> dist(0, 255);
    for (size_t i = 0; i < buffer.size(); i++) {
      buffer[i] = static_cast<unsigned char>(dist(rng));
    }
  }
  return toHex(buffer.data(), buffer.size());
}

string urlEncode(const string &value) {
  static const char *hex = "0123456789ABCDEF";
  string out;
  out.reserve(value.size() * 3);
  for (unsigned char c : value) {
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
      out.push_back(static_cast<char>(c));
    } else {
      out.push_back('%');
      out.push_back(hex[c >> 4]);
      out.push_back(hex[c & 0x0F]);
    }
  }
  return out;
}

string urlDecode(const string &value) {
  string out;
  out.reserve(value.size());
  for (size_t i = 0; i < value.size(); i++) {
    if (value[i] == '%' && i + 2 < value.size()) {
      char h1 = value[i + 1];
      char h2 = value[i + 2];
      auto hexVal = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
        if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
        return -1;
      };
      int hi = hexVal(h1);
      int lo = hexVal(h2);
      if (hi >= 0 && lo >= 0) {
        out.push_back(static_cast<char>((hi << 4) | lo));
        i += 2;
        continue;
      }
    }
    if (value[i] == '+') {
      out.push_back(' ');
    } else {
      out.push_back(value[i]);
    }
  }
  return out;
}

unordered_map<string, string> parseCookies(const string &cookieHeader) {
  unordered_map<string, string> cookies;
  for (const string &part : splitBy(cookieHeader, ';')) {
    size_t equals = part.find('=');
    if (equals == string::npos) {
      continue;
    }
    string key = trimCopy(part.substr(0, equals));
    string value = trimCopy(part.substr(equals + 1));
    if (!key.empty()) {
      cookies[key] = value;
    }
  }
  return cookies;
}

string jsonUnescape(const string &value) {
  string out;
  out.reserve(value.size());
  for (size_t i = 0; i < value.size(); i++) {
    char c = value[i];
    if (c == '\\' && i + 1 < value.size()) {
      char next = value[i + 1];
      switch (next) {
      case '\\':
        out.push_back('\\');
        break;
      case '"':
        out.push_back('"');
        break;
      case '/':
        out.push_back('/');
        break;
      case 'b':
        out.push_back('\b');
        break;
      case 'f':
        out.push_back('\f');
        break;
      case 'n':
        out.push_back('\n');
        break;
      case 'r':
        out.push_back('\r');
        break;
      case 't':
        out.push_back('\t');
        break;
      default:
        out.push_back(next);
        break;
      }
      i++;
    } else {
      out.push_back(c);
    }
  }
  return out;
}

optional<string> extractJSONString(const string &json, const string &key) {
  string pattern = "\"" + key + "\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"";
  regex re(pattern);
  smatch match;
  if (!regex_search(json, match, re) || match.size() < 2) {
    return nullopt;
  }
  return jsonUnescape(match[1].str());
}

optional<long long> extractJSONInt(const string &json, const string &key) {
  string pattern = "\"" + key + "\"\\s*:\\s*([0-9]+)";
  regex re(pattern);
  smatch match;
  if (!regex_search(json, match, re) || match.size() < 2) {
    return nullopt;
  }
  try {
    return stoll(match[1].str());
  } catch (...) {
    return nullopt;
  }
}

vector<string> extractAllJSONFieldValues(const string &json, const string &key) {
  vector<string> out;
  string pattern = "\"" + key + "\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"";
  regex re(pattern);
  for (sregex_iterator i(json.begin(), json.end(), re), end; i != end; ++i) {
    out.push_back(jsonUnescape((*i)[1].str()));
  }
  return out;
}

struct ParsedUrl {
  bool secure = true;
  string host;
  int port = 443;
  string path;
};

optional<ParsedUrl> parseHttpUrl(const string &url) {
  regex re(R"(^(https?)://([^/]+)(/.*)?$)", regex::icase);
  smatch match;
  if (!regex_match(url, match, re) || match.size() < 3) {
    return nullopt;
  }

  ParsedUrl parsed;
  parsed.secure = toLowerCopy(match[1].str()) == "https";
  string hostPort = match[2].str();
  size_t colon = hostPort.rfind(':');
  if (colon != string::npos && colon > 0 &&
      hostPort.find(']') == string::npos) {
    parsed.host = hostPort.substr(0, colon);
    try {
      parsed.port = stoi(hostPort.substr(colon + 1));
    } catch (...) {
      parsed.port = parsed.secure ? 443 : 80;
    }
  } else {
    parsed.host = hostPort;
    parsed.port = parsed.secure ? 443 : 80;
  }
  parsed.path = match.size() >= 4 && match[3].matched ? match[3].str() : "/";
  return parsed;
}

string joinPath(const string &a, const string &b) {
  if (a.empty()) return b;
  if (b.empty()) return a;
  if (a.back() == '/' && b.front() == '/') {
    return a + b.substr(1);
  }
  if (a.back() != '/' && b.front() != '/') {
    return a + "/" + b;
  }
  return a + b;
}

// ============================================
// USER CLASS
// ============================================
class User {
private:
  long long phoneNumber;

public:
  string email;
  string password;
  vector<User *> *friends;
  string userName;
  string name;
  string instagramHandle;
  string profilePic;

  User() : friends(new vector<User *>()) {}

  User(string userName, string name, long long num, string email,
       string password, string instagramHandle = "", string profilePic = "") {
    this->userName = userName;
    this->name = name;
    this->phoneNumber = num;
    this->email = email;
    this->password = password;
    this->instagramHandle = instagramHandle;
    this->profilePic = profilePic;
    this->friends = new vector<User *>();
  }

  string getIdOfUser() const { return userName; }
  string getNameOfUser() const { return name; }
  string getEmail() const { return email; }

  void addFriend(User *newFriend) { friends->push_back(newFriend); }
  vector<User *> *getFriendsOfUser() const { return friends; }

  bool isFriend(const string &friendUserName) const {
    for (size_t i = 0; i < friends->size(); i++) {
      if (friends->at(i)->getIdOfUser() == friendUserName) {
        return true;
      }
    }
    return false;
  }

  bool checkPassword(const string &inputPassword) const {
    return password == inputPassword;
  }

  string toJSON() const {
    string json = "{";
    json += "\"userName\":\"" + jsonEscape(userName) + "\",";
    json += "\"name\":\"" + jsonEscape(name) + "\",";
    json +=
        "\"instagramHandle\":\"" + jsonEscape(instagramHandle) + "\",";
    json += "\"profilePic\":\"" + jsonEscape(profilePic) + "\",";
    json += "\"email\":\"" + jsonEscape(email) + "\",";
    json += "\"friendsCount\":" + to_string(friends->size());

    json += ",\"friends\":[";
    for (size_t i = 0; i < friends->size(); i++) {
      json += "\"" + jsonEscape(friends->at(i)->getIdOfUser()) + "\"";
      if (i < friends->size() - 1)
        json += ",";
    }
    json += "]";

    json += "}";
    return json;
  }
};

// ============================================
// MESSAGE STRUCT
// ============================================
struct Message {
  string fromUser;
  string toUser;
  string text;
  string timestamp;

  string toJSON() const {
    string json = "{";
    json += "\"from\":\"" + jsonEscape(fromUser) + "\",";
    json += "\"to\":\"" + jsonEscape(toUser) + "\",";
    json += "\"text\":\"" + jsonEscape(text) + "\",";
    json += "\"timestamp\":\"" + jsonEscape(timestamp) + "\"";
    json += "}";
    return json;
  }
};

// ============================================
// POST SYSTEM STRUCTS
// ============================================
struct MediaAsset {
  string id;
  string ownerUserName;
  string mimeType;
  string originalFileName;
  string bytes;
  size_t sizeBytes;
  string createdAt;
};

struct PostMediaRef {
  string kind;
  string url;
  string mimeType;
  string mediaId;
  bool isSeededStatic;
};

struct PostComment {
  string id;
  string postId;
  string authorUserName;
  string text;
  string createdAt;
  string updatedAt;
  bool edited;
};

struct Post {
  string id;
  string authorUserName;
  string caption;
  vector<PostMediaRef> media;
  vector<string> likedBy;
  vector<PostComment> comments;
  string createdAt;
};

// ============================================
// SOCIAL NETWORK CLASS - In-memory database
// ============================================
class SocialNetwork {
private:
  vector<User *> *users;
  vector<Message *> *messages;
  vector<Post> posts;
  unordered_map<string, MediaAsset> mediaAssets;
  size_t totalMediaBytes;

  size_t postIdCounter;
  size_t commentIdCounter;
  size_t mediaIdCounter;

  bool isAllowedMimeType(const string &mimeType) const {
    static const vector<string> allowedMimeTypes = {
        "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"};

    return find(allowedMimeTypes.begin(), allowedMimeTypes.end(), mimeType) !=
           allowedMimeTypes.end();
  }

  string nextPostId() { return "post_" + to_string(++postIdCounter); }
  string nextCommentId() { return "comment_" + to_string(++commentIdCounter); }
  string nextMediaId() { return "media_" + to_string(++mediaIdCounter); }

public:
  SocialNetwork()
      : users(new vector<User *>()), messages(new vector<Message *>()),
        totalMediaBytes(0), postIdCounter(0), commentIdCounter(0),
        mediaIdCounter(0) {}

  ~SocialNetwork() {
    for (auto user : *users)
      delete user;
    for (auto msg : *messages)
      delete msg;

    delete users;
    delete messages;
  }

  // -------- Existing user/message features --------
  void addUser(User *newUser) { users->push_back(newUser); }
  void addMessage(Message *msg) { messages->push_back(msg); }

  User *findUser(const string &userName) {
    for (size_t i = 0; i < users->size(); i++) {
      if (users->at(i)->getIdOfUser() == userName) {
        return users->at(i);
      }
    }
    return nullptr;
  }

  const User *findUser(const string &userName) const {
    for (size_t i = 0; i < users->size(); i++) {
      if (users->at(i)->getIdOfUser() == userName) {
        return users->at(i);
      }
    }
    return nullptr;
  }

  User *findUserByEmail(const string &email) {
    string emailLower = toLowerCopy(email);
    for (size_t i = 0; i < users->size(); i++) {
      if (toLowerCopy(users->at(i)->getEmail()) == emailLower) {
        return users->at(i);
      }
    }
    return nullptr;
  }

  bool isUserNameTaken(const string &userName) const {
    return findUser(userName) != nullptr;
  }

  bool createUser(const string &userName, const string &name, long long phoneNumber,
                  const string &email, const string &password,
                  const string &instagramHandle, const string &profilePic,
                  User *&createdUser, string &errorMessage, int &errorStatus) {
    if (trimCopy(userName).empty() || trimCopy(name).empty() ||
        trimCopy(email).empty() || trimCopy(password).empty()) {
      errorStatus = 400;
      errorMessage = "userName, name, email, and password are required";
      return false;
    }

    if (phoneNumber <= 0) {
      errorStatus = 400;
      errorMessage = "phoneNumber must be a positive number";
      return false;
    }

    if (isUserNameTaken(userName)) {
      errorStatus = 409;
      errorMessage = "Username is already taken";
      return false;
    }

    if (findUserByEmail(email)) {
      errorStatus = 409;
      errorMessage = "Email is already registered";
      return false;
    }

    createdUser = new User(userName, name, phoneNumber, email, password,
                           instagramHandle, profilePic);
    addUser(createdUser);
    return true;
  }

  string getAllUsersJSON() {
    string json = "[";
    for (size_t i = 0; i < users->size(); i++) {
      json += users->at(i)->toJSON();
      if (i < users->size() - 1)
        json += ",";
    }
    json += "]";
    return json;
  }

  string getConversationJSON(const string &user1, const string &user2) {
    string json = "[";
    bool first = true;
    for (size_t i = 0; i < messages->size(); i++) {
      Message *msg = messages->at(i);
      if ((msg->fromUser == user1 && msg->toUser == user2) ||
          (msg->fromUser == user2 && msg->toUser == user1)) {
        if (!first)
          json += ",";
        json += msg->toJSON();
        first = false;
      }
    }
    json += "]";
    return json;
  }

  size_t getUserCount() const { return users->size(); }

  // -------- Post system --------
  const MediaAsset *findMediaAsset(const string &mediaId) const {
    auto it = mediaAssets.find(mediaId);
    if (it == mediaAssets.end()) {
      return nullptr;
    }
    return &it->second;
  }

  Post *findPost(const string &postId) {
    for (size_t i = 0; i < posts.size(); i++) {
      if (posts[i].id == postId) {
        return &posts[i];
      }
    }
    return nullptr;
  }

  const Post *findPost(const string &postId) const {
    for (size_t i = 0; i < posts.size(); i++) {
      if (posts[i].id == postId) {
        return &posts[i];
      }
    }
    return nullptr;
  }

  string buildPostJSON(const Post &post, const string &viewerUserName) const {
    const User *author = findUser(post.authorUserName);
    bool likedByViewer =
        find(post.likedBy.begin(), post.likedBy.end(), viewerUserName) !=
        post.likedBy.end();

    string json = "{";
    json += "\"id\":\"" + jsonEscape(post.id) + "\",";
    json +=
        "\"authorUserName\":\"" + jsonEscape(post.authorUserName) + "\",";
    json += "\"authorName\":\"" +
            jsonEscape(author ? author->name : post.authorUserName) + "\",";
    json += "\"authorProfilePic\":\"" +
            jsonEscape(author ? author->profilePic : "") + "\",";
    json += "\"caption\":\"" + jsonEscape(post.caption) + "\",";
    json += "\"createdAt\":\"" + jsonEscape(post.createdAt) + "\",";
    json += "\"likeCount\":" + to_string(post.likedBy.size()) + ",";
    json += "\"likedByViewer\":" + boolToJSON(likedByViewer) + ",";

    json += "\"likedBy\":[";
    for (size_t i = 0; i < post.likedBy.size(); i++) {
      json += "\"" + jsonEscape(post.likedBy[i]) + "\"";
      if (i < post.likedBy.size() - 1)
        json += ",";
    }
    json += "],";

    json += "\"media\":[";
    for (size_t i = 0; i < post.media.size(); i++) {
      const PostMediaRef &media = post.media[i];
      json += "{";
      json += "\"kind\":\"" + jsonEscape(media.kind) + "\",";
      json += "\"url\":\"" + jsonEscape(media.url) + "\",";
      json += "\"mimeType\":\"" + jsonEscape(media.mimeType) + "\",";
      json += "\"mediaId\":\"" + jsonEscape(media.mediaId) + "\",";
      json += "\"isSeededStatic\":" + boolToJSON(media.isSeededStatic);
      json += "}";
      if (i < post.media.size() - 1)
        json += ",";
    }
    json += "],";

    json += "\"comments\":[";
    for (size_t i = 0; i < post.comments.size(); i++) {
      const PostComment &comment = post.comments[i];
      const User *commentAuthor = findUser(comment.authorUserName);

      json += "{";
      json += "\"id\":\"" + jsonEscape(comment.id) + "\",";
      json += "\"postId\":\"" + jsonEscape(comment.postId) + "\",";
      json += "\"authorUserName\":\"" + jsonEscape(comment.authorUserName) +
              "\",";
      json += "\"authorName\":\"" +
              jsonEscape(commentAuthor ? commentAuthor->name
                                       : comment.authorUserName) +
              "\",";
      json += "\"authorProfilePic\":\"" +
              jsonEscape(commentAuthor ? commentAuthor->profilePic : "") +
              "\",";
      json += "\"text\":\"" + jsonEscape(comment.text) + "\",";
      json += "\"createdAt\":\"" + jsonEscape(comment.createdAt) + "\",";
      json += "\"updatedAt\":\"" + jsonEscape(comment.updatedAt) + "\",";
      json += "\"edited\":" + boolToJSON(comment.edited);
      json += "}";

      if (i < post.comments.size() - 1)
        json += ",";
    }
    json += "],";
    json += "\"commentCount\":" + to_string(post.comments.size());
    json += "}";

    return json;
  }

  string getPostJSONById(const string &postId, const string &viewerUserName) const {
    const Post *post = findPost(postId);
    if (!post) {
      return "{}";
    }
    return buildPostJSON(*post, viewerUserName);
  }

  vector<Post> getPostsSnapshot() const { return posts; }

  bool addUploadedPost(const string &authorUserName, const string &caption,
                       const vector<httplib::FormData> &files,
                       string &createdPostId, string &errorMessage,
                       int &errorStatus) {
    if (!findUser(authorUserName)) {
      errorStatus = 404;
      errorMessage = "User not found";
      return false;
    }

    if (caption.size() > static_cast<size_t>(MAX_CAPTION_LENGTH)) {
      errorStatus = 400;
      errorMessage = "Caption exceeds 2200 characters";
      return false;
    }

    if (files.empty() ||
        files.size() > static_cast<size_t>(MAX_MEDIA_FILES_PER_POST)) {
      errorStatus = 400;
      errorMessage = "Posts must include 1-4 media files";
      return false;
    }

    size_t incomingBytes = 0;
    for (const auto &file : files) {
      if (!isAllowedMimeType(file.content_type)) {
        errorStatus = 400;
        errorMessage = "Unsupported media type: " + file.content_type;
        return false;
      }
      incomingBytes += file.content.size();
    }

    if (totalMediaBytes + incomingBytes > MEDIA_BYTES_CAP) {
      errorStatus = 413;
      errorMessage = "Upload rejected: server media memory cap reached";
      return false;
    }

    Post post;
    post.id = nextPostId();
    post.authorUserName = authorUserName;
    post.caption = caption;
    post.createdAt = getCurrentUtcIsoTimestamp();

    for (const auto &file : files) {
      MediaAsset asset;
      asset.id = nextMediaId();
      asset.ownerUserName = authorUserName;
      asset.mimeType = file.content_type;
      asset.originalFileName = file.filename;
      asset.bytes = file.content;
      asset.sizeBytes = file.content.size();
      asset.createdAt = getCurrentUtcIsoTimestamp();

      string mediaId = asset.id;
      totalMediaBytes += asset.sizeBytes;
      mediaAssets[mediaId] = std::move(asset);

      PostMediaRef mediaRef;
      mediaRef.kind =
          file.content_type.rfind("video/", 0) == 0 ? "video" : "image";
      mediaRef.url = "/api/posts/media?mediaId=" + mediaId;
      mediaRef.mimeType = file.content_type;
      mediaRef.mediaId = mediaId;
      mediaRef.isSeededStatic = false;
      post.media.push_back(mediaRef);
    }

    posts.push_back(post);
    createdPostId = post.id;
    return true;
  }

  bool addSeededPost(const string &authorUserName, const string &caption,
                     const vector<PostMediaRef> &mediaRefs) {
    if (!findUser(authorUserName) || mediaRefs.empty()) {
      return false;
    }

    Post post;
    post.id = nextPostId();
    post.authorUserName = authorUserName;
    post.caption = caption;
    post.media = mediaRefs;
    post.createdAt = getCurrentUtcIsoTimestamp();
    posts.push_back(post);
    return true;
  }

  void seedDemoPosts(size_t count, const vector<PostMediaRef> &seedMedia,
                     const vector<string> &captions) {
    if (users->empty() || seedMedia.empty() || captions.empty()) {
      return;
    }

    for (size_t i = 0; i < count; i++) {
      const User *randomUser = users->at(rand() % users->size());
      const string &caption = captions[rand() % captions.size()];

      vector<PostMediaRef> refs;
      refs.push_back(seedMedia[rand() % seedMedia.size()]);

      if (rand() % 4 == 0) {
        refs.push_back(seedMedia[rand() % seedMedia.size()]);
      }

      addSeededPost(randomUser->userName, caption, refs);
    }
  }

  string getPostsPageJSON(int page, int limit, const string &query,
                          const string &viewerUserName) const {
    vector<const Post *> filteredPosts;
    string queryLower = toLowerCopy(query);

    for (auto it = posts.rbegin(); it != posts.rend(); ++it) {
      const Post &post = *it;
      const User *author = findUser(post.authorUserName);
      string authorName = author ? author->name : post.authorUserName;

      if (queryLower.empty() || containsCaseInsensitive(post.caption, queryLower) ||
          containsCaseInsensitive(post.authorUserName, queryLower) ||
          containsCaseInsensitive(authorName, queryLower)) {
        filteredPosts.push_back(&post);
      }
    }

    int totalItems = static_cast<int>(filteredPosts.size());
    int start = (page - 1) * limit;
    int end = min(start + limit, totalItems);

    string json = "{";
    json += "\"items\":[";

    if (start < totalItems) {
      for (int i = start; i < end; i++) {
        json += buildPostJSON(*filteredPosts[i], viewerUserName);
        if (i < end - 1) {
          json += ",";
        }
      }
    }

    json += "],";
    json += "\"page\":" + to_string(page) + ",";
    json += "\"limit\":" + to_string(limit) + ",";
    json += "\"totalItems\":" + to_string(totalItems) + ",";
    json += "\"hasMore\":" + boolToJSON(end < totalItems);
    json += "}";

    return json;
  }

  bool likePost(const string &postId, const string &actorUserName,
                bool &alreadyLiked, string &errorMessage, int &errorStatus) {
    Post *post = findPost(postId);
    if (!post) {
      errorStatus = 404;
      errorMessage = "Post not found";
      return false;
    }

    if (!findUser(actorUserName)) {
      errorStatus = 404;
      errorMessage = "User not found";
      return false;
    }

    auto it = find(post->likedBy.begin(), post->likedBy.end(), actorUserName);
    if (it != post->likedBy.end()) {
      alreadyLiked = true;
      return true;
    }

    post->likedBy.push_back(actorUserName);
    alreadyLiked = false;
    return true;
  }

  bool addCommentToPost(const string &postId, const string &actorUserName,
                        const string &text, string &errorMessage,
                        int &errorStatus) {
    Post *post = findPost(postId);
    if (!post) {
      errorStatus = 404;
      errorMessage = "Post not found";
      return false;
    }

    if (!findUser(actorUserName)) {
      errorStatus = 404;
      errorMessage = "User not found";
      return false;
    }

    string trimmed = trimCopy(text);
    if (trimmed.empty()) {
      errorStatus = 400;
      errorMessage = "Comment cannot be empty";
      return false;
    }

    if (trimmed.size() > static_cast<size_t>(MAX_COMMENT_LENGTH)) {
      errorStatus = 400;
      errorMessage = "Comment exceeds 500 characters";
      return false;
    }

    PostComment comment;
    comment.id = nextCommentId();
    comment.postId = postId;
    comment.authorUserName = actorUserName;
    comment.text = trimmed;
    comment.createdAt = getCurrentUtcIsoTimestamp();
    comment.updatedAt = comment.createdAt;
    comment.edited = false;

    post->comments.push_back(comment);
    return true;
  }

  bool editCommentOnPost(const string &postId, const string &commentId,
                         const string &actorUserName, const string &text,
                         string &errorMessage, int &errorStatus) {
    Post *post = findPost(postId);
    if (!post) {
      errorStatus = 404;
      errorMessage = "Post not found";
      return false;
    }

    string trimmed = trimCopy(text);
    if (trimmed.empty()) {
      errorStatus = 400;
      errorMessage = "Comment cannot be empty";
      return false;
    }

    if (trimmed.size() > static_cast<size_t>(MAX_COMMENT_LENGTH)) {
      errorStatus = 400;
      errorMessage = "Comment exceeds 500 characters";
      return false;
    }

    for (size_t i = 0; i < post->comments.size(); i++) {
      PostComment &comment = post->comments[i];
      if (comment.id == commentId) {
        if (comment.authorUserName != actorUserName) {
          errorStatus = 403;
          errorMessage = "Only the comment author can edit this comment";
          return false;
        }

        comment.text = trimmed;
        comment.updatedAt = getCurrentUtcIsoTimestamp();
        comment.edited = true;
        return true;
      }
    }

    errorStatus = 404;
    errorMessage = "Comment not found";
    return false;
  }

  bool deleteCommentFromPost(const string &postId, const string &commentId,
                             const string &actorUserName, string &errorMessage,
                             int &errorStatus) {
    Post *post = findPost(postId);
    if (!post) {
      errorStatus = 404;
      errorMessage = "Post not found";
      return false;
    }

    for (size_t i = 0; i < post->comments.size(); i++) {
      if (post->comments[i].id == commentId) {
        if (post->comments[i].authorUserName != actorUserName) {
          errorStatus = 403;
          errorMessage = "Only the comment author can delete this comment";
          return false;
        }

        post->comments.erase(post->comments.begin() + static_cast<long>(i));
        return true;
      }
    }

    errorStatus = 404;
    errorMessage = "Comment not found";
    return false;
  }

  bool deletePostById(const string &postId, const string &actorUserName,
                      string &errorMessage, int &errorStatus) {
    for (size_t i = 0; i < posts.size(); i++) {
      if (posts[i].id == postId) {
        if (posts[i].authorUserName != actorUserName) {
          errorStatus = 403;
          errorMessage = "Only the post author can delete this post";
          return false;
        }

        for (const auto &mediaRef : posts[i].media) {
          if (mediaRef.isSeededStatic) {
            continue;
          }

          auto mediaIt = mediaAssets.find(mediaRef.mediaId);
          if (mediaIt != mediaAssets.end()) {
            if (mediaIt->second.sizeBytes <= totalMediaBytes) {
              totalMediaBytes -= mediaIt->second.sizeBytes;
            }
            mediaAssets.erase(mediaIt);
          }
        }

        posts.erase(posts.begin() + static_cast<long>(i));
        return true;
      }
    }

    errorStatus = 404;
    errorMessage = "Post not found";
    return false;
  }
};

// ============================================
// HELPER: Extract a string value from a simple JSON string
// ============================================
string getJSONValue(const string &json, const string &key) {
  string searchKey = "\"" + key + "\":\"";
  size_t start = json.find(searchKey);
  if (start == string::npos)
    return "";
  start += searchKey.length();
  size_t end = json.find("\"", start);
  if (end == string::npos)
    return "";
  return json.substr(start, end - start);
}

struct SessionRecord {
  string sessionId;
  string userName;
  string role;
  string csrfToken;
  long long expiresAt = 0;
};

struct InstagramConnectionRecord {
  int id = 0;
  string igUserId;
  string igUsername;
  string tokenEncrypted;
  long long tokenExpiresAt = 0;
  string scopes;
  long long lastSyncAt = 0;
  string status;
};

struct InstagramMediaRecord {
  string igMediaId;
  int connectionId = 0;
  string mediaType;
  string caption;
  string permalink;
  string timestamp;
  string mediaUrl;
  string thumbnailUrl;
  string r2Key;
  string r2ThumbKey;
  bool isActive = true;
  string rawJson;
};

class InMemoryStore {
private:
  mutex storeMutex;
  unordered_map<string, SessionRecord> sessions;
  unordered_map<int, InstagramConnectionRecord> connectionsById;
  unordered_map<string, int> connectionIdByIgUserId;
  unordered_map<string, InstagramMediaRecord> mediaById;
  int nextConnectionId = 1;

public:
  bool open(const string &path, string &errorMessage) {
    (void)path;
    errorMessage.clear();
    return true;
  }

  bool initSchema(string &errorMessage) {
    errorMessage.clear();
    return true;
  }

  bool upsertSession(const SessionRecord &session, string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    sessions[session.sessionId] = session;
    errorMessage.clear();
    return true;
  }

  optional<SessionRecord> getSession(const string &sessionId,
                                     string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    auto it = sessions.find(sessionId);
    if (it == sessions.end()) {
      return nullopt;
    }

    if (it->second.expiresAt <= nowUnixSeconds()) {
      sessions.erase(it);
      return nullopt;
    }

    errorMessage.clear();
    return it->second;
  }

  bool updateSessionCsrfToken(const string &sessionId, const string &csrfToken,
                              string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    auto it = sessions.find(sessionId);
    if (it == sessions.end()) {
      errorMessage = "Session not found";
      return false;
    }
    it->second.csrfToken = csrfToken;
    errorMessage.clear();
    return true;
  }

  bool deleteSession(const string &sessionId, string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    sessions.erase(sessionId);
    errorMessage.clear();
    return true;
  }

  bool upsertInstagramConnection(InstagramConnectionRecord &record,
                                 string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);

    auto existingIdIt = connectionIdByIgUserId.find(record.igUserId);
    if (existingIdIt != connectionIdByIgUserId.end()) {
      auto connectionIt = connectionsById.find(existingIdIt->second);
      if (connectionIt != connectionsById.end()) {
        connectionIt->second.igUsername = record.igUsername;
        connectionIt->second.tokenEncrypted = record.tokenEncrypted;
        connectionIt->second.tokenExpiresAt = record.tokenExpiresAt;
        connectionIt->second.scopes = record.scopes;
        connectionIt->second.status =
            record.status.empty() ? connectionIt->second.status : record.status;
        record = connectionIt->second;
        errorMessage.clear();
        return true;
      }
      connectionIdByIgUserId.erase(existingIdIt);
    }

    if (record.status.empty()) {
      record.status = "active";
    }
    record.id = nextConnectionId++;
    connectionsById[record.id] = record;
    connectionIdByIgUserId[record.igUserId] = record.id;
    errorMessage.clear();
    return true;
  }

  vector<InstagramConnectionRecord> listConnections(string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    vector<InstagramConnectionRecord> out;
    out.reserve(connectionsById.size());
    for (const auto &entry : connectionsById) {
      out.push_back(entry.second);
    }
    sort(out.begin(), out.end(),
         [](const InstagramConnectionRecord &a,
            const InstagramConnectionRecord &b) { return a.id > b.id; });
    errorMessage.clear();
    return out;
  }

  optional<InstagramConnectionRecord> getConnectionById(int id,
                                                        string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    auto it = connectionsById.find(id);
    if (it == connectionsById.end()) {
      return nullopt;
    }
    errorMessage.clear();
    return it->second;
  }

  bool updateConnectionSyncMetadata(int id, long long lastSyncAt,
                                    const string &status,
                                    string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    auto it = connectionsById.find(id);
    if (it == connectionsById.end()) {
      errorMessage = "Instagram connection not found";
      return false;
    }
    it->second.lastSyncAt = lastSyncAt;
    it->second.status = status;
    errorMessage.clear();
    return true;
  }

  bool updateConnectionToken(int id, const string &tokenEncrypted,
                             long long tokenExpiresAt, string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    auto it = connectionsById.find(id);
    if (it == connectionsById.end()) {
      errorMessage = "Instagram connection not found";
      return false;
    }
    it->second.tokenEncrypted = tokenEncrypted;
    it->second.tokenExpiresAt = tokenExpiresAt;
    errorMessage.clear();
    return true;
  }

  bool deleteConnection(int id, string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    auto connectionIt = connectionsById.find(id);
    if (connectionIt != connectionsById.end()) {
      connectionIdByIgUserId.erase(connectionIt->second.igUserId);
      connectionsById.erase(connectionIt);
    }

    for (auto mediaIt = mediaById.begin(); mediaIt != mediaById.end();) {
      if (mediaIt->second.connectionId == id) {
        mediaIt = mediaById.erase(mediaIt);
      } else {
        ++mediaIt;
      }
    }

    errorMessage.clear();
    return true;
  }

  bool upsertInstagramMedia(const InstagramMediaRecord &record,
                            string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    mediaById[record.igMediaId] = record;
    errorMessage.clear();
    return true;
  }

  bool deactivateMissingMedia(int connectionId, const vector<string> &activeIds,
                              string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    unordered_set<string> activeSet(activeIds.begin(), activeIds.end());

    for (auto &entry : mediaById) {
      auto &media = entry.second;
      if (media.connectionId != connectionId) {
        continue;
      }
      media.isActive = activeSet.count(media.igMediaId) > 0;
    }

    errorMessage.clear();
    return true;
  }

  vector<InstagramMediaRecord> listActiveInstagramMedia(string &errorMessage) {
    lock_guard<mutex> lock(storeMutex);
    vector<InstagramMediaRecord> out;
    for (const auto &entry : mediaById) {
      if (entry.second.isActive) {
        out.push_back(entry.second);
      }
    }

    sort(out.begin(), out.end(),
         [](const InstagramMediaRecord &a, const InstagramMediaRecord &b) {
           if (a.timestamp == b.timestamp) {
             return a.igMediaId > b.igMediaId;
           }
           return a.timestamp > b.timestamp;
         });
    errorMessage.clear();
    return out;
  }
};

class TokenCipher {
private:
  vector<unsigned char> key;

public:
  explicit TokenCipher(const string &passphrase) {
    unsigned char digest[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char *>(passphrase.data()),
           passphrase.size(), digest);
    key.assign(digest, digest + SHA256_DIGEST_LENGTH);
  }

  string encrypt(const string &plain, string &errorMessage) const {
    vector<unsigned char> iv(12, 0);
    if (RAND_bytes(iv.data(), static_cast<int>(iv.size())) != 1) {
      errorMessage = "Failed to create random IV";
      return "";
    }

    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    if (!ctx) {
      errorMessage = "Failed to allocate cipher context";
      return "";
    }

    vector<unsigned char> ciphertext(plain.size() + 16, 0);
    int outLen = 0;
    int totalLen = 0;
    vector<unsigned char> tag(16, 0);

    bool ok = EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr,
                                 nullptr) == 1;
    ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN,
                                   static_cast<int>(iv.size()), nullptr) == 1;
    ok = ok && EVP_EncryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data()) == 1;
    ok = ok &&
         EVP_EncryptUpdate(ctx, ciphertext.data(), &outLen,
                           reinterpret_cast<const unsigned char *>(plain.data()),
                           static_cast<int>(plain.size())) == 1;
    totalLen += outLen;
    ok = ok && EVP_EncryptFinal_ex(ctx, ciphertext.data() + totalLen, &outLen) == 1;
    totalLen += outLen;
    ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, 16, tag.data()) == 1;

    EVP_CIPHER_CTX_free(ctx);
    if (!ok) {
      errorMessage = "AES-GCM encryption failed";
      return "";
    }

    return toHex(iv.data(), iv.size()) + ":" + toHex(tag.data(), tag.size()) +
           ":" + toHex(ciphertext.data(), static_cast<size_t>(totalLen));
  }

  optional<string> decrypt(const string &encrypted, string &errorMessage) const {
    vector<string> parts = splitBy(encrypted, ':');
    if (parts.size() != 3) {
      errorMessage = "Invalid encrypted token format";
      return nullopt;
    }
    vector<unsigned char> iv = fromHex(parts[0]);
    vector<unsigned char> tag = fromHex(parts[1]);
    vector<unsigned char> cipher = fromHex(parts[2]);
    if (iv.empty() || tag.size() != 16 || cipher.empty()) {
      errorMessage = "Encrypted token hex parse failed";
      return nullopt;
    }

    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    if (!ctx) {
      errorMessage = "Failed to allocate cipher context";
      return nullopt;
    }

    vector<unsigned char> plain(cipher.size() + 16, 0);
    int outLen = 0;
    int totalLen = 0;
    bool ok = EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), nullptr, nullptr,
                                 nullptr) == 1;
    ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN,
                                   static_cast<int>(iv.size()), nullptr) == 1;
    ok = ok && EVP_DecryptInit_ex(ctx, nullptr, nullptr, key.data(), iv.data()) == 1;
    ok = ok && EVP_DecryptUpdate(ctx, plain.data(), &outLen, cipher.data(),
                                 static_cast<int>(cipher.size())) == 1;
    totalLen += outLen;
    ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, 16, tag.data()) == 1;
    ok = ok && EVP_DecryptFinal_ex(ctx, plain.data() + totalLen, &outLen) == 1;
    totalLen += outLen;

    EVP_CIPHER_CTX_free(ctx);
    if (!ok) {
      errorMessage = "AES-GCM decryption failed";
      return nullopt;
    }

    return string(reinterpret_cast<char *>(plain.data()),
                  static_cast<size_t>(totalLen));
  }
};

struct HttpResult {
  int status = 0;
  string body;
  string error;
};

HttpResult httpRequest(const string &method, const ParsedUrl &url,
                       const string &body, const string &contentType,
                       const httplib::Headers &headers) {
  HttpResult result;
  const string scheme = url.secure ? "https" : "http";
  const string schemeHostPort = scheme + "://" + url.host + ":" + to_string(url.port);
  httplib::Client client(schemeHostPort);
  client.set_connection_timeout(10);
  client.set_read_timeout(30);
  client.set_write_timeout(30);

  httplib::Result res;
  if (method == "GET") {
    res = client.Get(url.path, headers);
  } else if (method == "POST") {
    res = client.Post(url.path, headers, body, contentType);
  } else if (method == "PUT") {
    res = client.Put(url.path, headers, body, contentType);
  } else if (method == "DELETE") {
    res = client.Delete(url.path, headers, body, contentType);
  } else {
    result.error = "Unsupported method: " + method;
    return result;
  }

  if (!res) {
    result.error = "HTTP request failed: " + method + " " + url.host + url.path;
    return result;
  }
  result.status = res->status;
  result.body = res->body;
  return result;
}

HttpResult httpGetUrl(const string &url, const httplib::Headers &headers = {}) {
  auto parsed = parseHttpUrl(url);
  if (!parsed) {
    return HttpResult{0, "", "Invalid URL: " + url};
  }
  return httpRequest("GET", *parsed, "", "", headers);
}

HttpResult httpPostForm(const string &url, const unordered_map<string, string> &form) {
  auto parsed = parseHttpUrl(url);
  if (!parsed) {
    return HttpResult{0, "", "Invalid URL: " + url};
  }
  string body;
  bool first = true;
  for (const auto &entry : form) {
    if (!first) body += "&";
    first = false;
    body += urlEncode(entry.first) + "=" + urlEncode(entry.second);
  }
  return httpRequest("POST", *parsed, body, "application/x-www-form-urlencoded", {});
}

string buildIsoDate(time_t utc, const char *format) {
  tm out{};
#if defined(_WIN32)
  gmtime_s(&out, &utc);
#else
  gmtime_r(&utc, &out);
#endif
  char buffer[64];
  strftime(buffer, sizeof(buffer), format, &out);
  return string(buffer);
}

string normalizeR2ObjectKeySegment(const string &segment) {
  string out;
  out.reserve(segment.size());
  for (unsigned char c : segment) {
    if (isalnum(c) || c == '-' || c == '_' || c == '.') {
      out.push_back(static_cast<char>(c));
    } else {
      out.push_back('_');
    }
  }
  if (out.empty()) return "unknown";
  return out;
}

string guessExtension(const string &contentType, const string &fallbackUrl) {
  string lower = toLowerCopy(contentType);
  if (lower.find("image/jpeg") != string::npos) return "jpg";
  if (lower.find("image/png") != string::npos) return "png";
  if (lower.find("image/webp") != string::npos) return "webp";
  if (lower.find("image/gif") != string::npos) return "gif";
  if (lower.find("video/mp4") != string::npos) return "mp4";
  if (lower.find("video/webm") != string::npos) return "webm";

  size_t lastDot = fallbackUrl.rfind('.');
  if (lastDot != string::npos && lastDot + 1 < fallbackUrl.size()) {
    string ext = fallbackUrl.substr(lastDot + 1);
    size_t q = ext.find('?');
    if (q != string::npos) ext = ext.substr(0, q);
    ext = toLowerAlnum(ext);
    if (!ext.empty()) return ext;
  }
  return "bin";
}

class InstagramIntegrationService {
private:
  InMemoryStore &store;
  TokenCipher &cipher;

  string igAppId;
  string igAppSecret;
  string igRedirectUri;
  string igScopes;
  string igVersion;

  string r2AccountId;
  string r2AccessKeyId;
  string r2SecretAccessKey;
  string r2Bucket;
  string r2PublicBaseUrl;
  string r2Region;

  bool isR2Configured() const {
    return !r2AccountId.empty() && !r2AccessKeyId.empty() &&
           !r2SecretAccessKey.empty() && !r2Bucket.empty() &&
           !r2PublicBaseUrl.empty();
  }

  static bool isTokenServerError(int status) {
    return status == 429 || (status >= 500 && status <= 599);
  }

  bool refreshLongLivedTokenIfNeeded(InstagramConnectionRecord &connection,
                                     string &tokenPlain, string &errorMessage,
                                     int &statusCode) {
    long long now = nowUnixSeconds();
    long long refreshThreshold = 10LL * 24LL * 60LL * 60LL;
    if (connection.tokenExpiresAt - now > refreshThreshold) {
      return true;
    }

    string refreshUrl =
        "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=" +
        urlEncode(tokenPlain);
    HttpResult refresh = httpGetUrl(refreshUrl);
    statusCode = refresh.status;
    if (refresh.status < 200 || refresh.status >= 300) {
      errorMessage = "Token refresh failed with status " + to_string(refresh.status) +
                     ": " + refresh.body;
      return false;
    }

    auto refreshedToken = extractJSONString(refresh.body, "access_token");
    auto expiresIn = extractJSONInt(refresh.body, "expires_in");
    if (!refreshedToken || !expiresIn) {
      errorMessage = "Token refresh response missing fields";
      return false;
    }
    tokenPlain = *refreshedToken;
    connection.tokenExpiresAt = now + *expiresIn;
    string encrypted;
    encrypted = cipher.encrypt(tokenPlain, errorMessage);
    if (encrypted.empty()) {
      return false;
    }
    connection.tokenEncrypted = encrypted;
    if (!store.updateConnectionToken(connection.id, encrypted,
                                     connection.tokenExpiresAt, errorMessage)) {
      return false;
    }
    return true;
  }

  bool fetchInstagramProfile(const string &token, string &igUserId,
                             string &igUsername, string &errorMessage,
                             int &statusCode) {
    string url = "https://graph.instagram.com/" + igVersion +
                 "/me?fields=user_id,username&access_token=" + urlEncode(token);
    HttpResult meRes = httpGetUrl(url);
    statusCode = meRes.status;
    if (meRes.status < 200 || meRes.status >= 300) {
      errorMessage = "Failed to fetch Instagram profile: " + meRes.body;
      return false;
    }

    auto userId = extractJSONString(meRes.body, "user_id");
    auto username = extractJSONString(meRes.body, "username");
    if (!userId || !username) {
      auto fallbackId = extractJSONString(meRes.body, "id");
      if (!fallbackId || !username) {
        errorMessage = "Profile response missing user_id/username";
        return false;
      }
      igUserId = *fallbackId;
      igUsername = *username;
      return true;
    }

    igUserId = *userId;
    igUsername = *username;
    return true;
  }

  bool uploadBytesToR2(const string &key, const string &contentType,
                       const string &payload, string &errorMessage) {
    if (!isR2Configured()) {
      errorMessage = "R2 is not configured";
      return false;
    }

    string host = r2AccountId + ".r2.cloudflarestorage.com";
    string canonicalUri = "/" + r2Bucket + "/" + key;
    string url = "https://" + host + canonicalUri;

    time_t now = time(nullptr);
    string amzDate = buildIsoDate(now, "%Y%m%dT%H%M%SZ");
    string dateStamp = buildIsoDate(now, "%Y%m%d");
    string payloadHash = sha256Hex(payload);
    string canonicalHeaders = "host:" + host + "\n" +
                              "x-amz-content-sha256:" + payloadHash + "\n" +
                              "x-amz-date:" + amzDate + "\n";
    string signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    string canonicalRequest = "PUT\n" + canonicalUri + "\n\n" + canonicalHeaders +
                              "\n" + signedHeaders + "\n" + payloadHash;
    string credentialScope = dateStamp + "/" + r2Region + "/s3/aws4_request";
    string stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + credentialScope +
                          "\n" + sha256Hex(canonicalRequest);

    vector<unsigned char> kDate =
        hmacSha256("AWS4" + r2SecretAccessKey, dateStamp);
    vector<unsigned char> kRegion = hmacSha256(kDate, r2Region);
    vector<unsigned char> kService = hmacSha256(kRegion, "s3");
    vector<unsigned char> kSigning = hmacSha256(kService, "aws4_request");
    vector<unsigned char> signature = hmacSha256(kSigning, stringToSign);
    string signatureHex = toHex(signature.data(), signature.size());

    string authorization = "AWS4-HMAC-SHA256 Credential=" + r2AccessKeyId + "/" +
                           credentialScope + ", SignedHeaders=" + signedHeaders +
                           ", Signature=" + signatureHex;

    httplib::Headers headers = {
        {"Host", host},
        {"x-amz-content-sha256", payloadHash},
        {"x-amz-date", amzDate},
        {"Authorization", authorization},
        {"Content-Type", contentType.empty() ? "application/octet-stream" : contentType},
    };

    HttpResult putRes = httpRequest("PUT", *parseHttpUrl(url), payload,
                                    contentType.empty() ? "application/octet-stream" : contentType,
                                    headers);
    if (putRes.status < 200 || putRes.status >= 300) {
      errorMessage = "R2 upload failed (" + to_string(putRes.status) + "): " +
                     putRes.body;
      return false;
    }
    return true;
  }

  string buildPublicR2Url(const string &key) const {
    return joinPath(r2PublicBaseUrl, key);
  }

  bool cacheAssetIfConfigured(const string &igUserId, const string &igMediaId,
                              const string &variant, const string &sourceUrl,
                              string &finalUrl, string &storedKey,
                              string &errorMessage) {
    finalUrl = sourceUrl;
    storedKey = "";

    if (sourceUrl.empty() || !isR2Configured()) {
      return true;
    }

    HttpResult download = httpGetUrl(sourceUrl);
    if (download.status < 200 || download.status >= 300) {
      errorMessage = "Asset download failed (" + to_string(download.status) + ")";
      return false;
    }

    string contentType = "";
    string ext = guessExtension(contentType, sourceUrl);
    string key = "instagram/" + normalizeR2ObjectKeySegment(igUserId) + "/" +
                 normalizeR2ObjectKeySegment(igMediaId) + "/" +
                 normalizeR2ObjectKeySegment(variant) + "." + ext;

    if (!uploadBytesToR2(key, contentType, download.body, errorMessage)) {
      return false;
    }
    finalUrl = buildPublicR2Url(key);
    storedKey = key;
    return true;
  }

public:
  InstagramIntegrationService(InMemoryStore &storeRef, TokenCipher &cipherRef)
      : store(storeRef), cipher(cipherRef) {
    igAppId = getEnvOrDefault("IG_APP_ID", "");
    igAppSecret = getEnvOrDefault("IG_APP_SECRET", "");
    igRedirectUri = getEnvOrDefault("IG_REDIRECT_URI", "");
    igScopes = getEnvOrDefault("IG_SCOPE", "instagram_business_basic");
    igVersion = getEnvOrDefault("IG_GRAPH_VERSION", "v25.0");

    r2AccountId = getEnvOrDefault("R2_ACCOUNT_ID", "");
    r2AccessKeyId = getEnvOrDefault("R2_ACCESS_KEY_ID", "");
    r2SecretAccessKey = getEnvOrDefault("R2_SECRET_ACCESS_KEY", "");
    r2Bucket = getEnvOrDefault("R2_BUCKET", "");
    r2PublicBaseUrl = getEnvOrDefault("R2_PUBLIC_BASE_URL", "");
    r2Region = getEnvOrDefault("R2_REGION", "auto");
  }

  bool isConfigured() const {
    return !igAppId.empty() && !igAppSecret.empty() && !igRedirectUri.empty();
  }

  string buildOAuthAuthorizationUrl(const string &state) const {
    string url = "https://www.instagram.com/oauth/authorize";
    url += "?client_id=" + urlEncode(igAppId);
    url += "&redirect_uri=" + urlEncode(igRedirectUri);
    url += "&response_type=code";
    url += "&scope=" + urlEncode(igScopes);
    url += "&state=" + urlEncode(state);
    url += "&force_reauth=true";
    url += "&enable_fb_login=true";
    return url;
  }

  bool exchangeCodeAndStoreConnection(const string &code,
                                      InstagramConnectionRecord &connection,
                                      string &errorMessage) {
    unordered_map<string, string> tokenForm = {
        {"client_id", igAppId},
        {"client_secret", igAppSecret},
        {"grant_type", "authorization_code"},
        {"redirect_uri", igRedirectUri},
        {"code", code},
    };
    HttpResult shortTokenRes =
        httpPostForm("https://api.instagram.com/oauth/access_token", tokenForm);
    if (shortTokenRes.status < 200 || shortTokenRes.status >= 300) {
      errorMessage = "Short-lived token exchange failed (" +
                     to_string(shortTokenRes.status) + "): " + shortTokenRes.body;
      return false;
    }

    auto shortToken = extractJSONString(shortTokenRes.body, "access_token");
    if (!shortToken) {
      errorMessage = "Short-lived token missing access_token";
      return false;
    }

    string longUrl =
        "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=" +
        urlEncode(igAppSecret) + "&access_token=" + urlEncode(*shortToken);
    HttpResult longTokenRes = httpGetUrl(longUrl);
    if (longTokenRes.status < 200 || longTokenRes.status >= 300) {
      errorMessage = "Long-lived token exchange failed (" +
                     to_string(longTokenRes.status) + "): " + longTokenRes.body;
      return false;
    }

    auto longToken = extractJSONString(longTokenRes.body, "access_token");
    auto expiresIn = extractJSONInt(longTokenRes.body, "expires_in");
    if (!longToken || !expiresIn) {
      errorMessage = "Long-lived token response missing fields";
      return false;
    }

    string igUserId;
    string igUsername;
    int statusCode = 0;
    if (!fetchInstagramProfile(*longToken, igUserId, igUsername, errorMessage,
                               statusCode)) {
      return false;
    }

    string encryptedToken = cipher.encrypt(*longToken, errorMessage);
    if (encryptedToken.empty()) {
      return false;
    }

    connection.igUserId = igUserId;
    connection.igUsername = igUsername;
    connection.tokenEncrypted = encryptedToken;
    connection.tokenExpiresAt = nowUnixSeconds() + *expiresIn;
    connection.scopes = igScopes;
    connection.lastSyncAt = 0;
    connection.status = "active";

    if (!store.upsertInstagramConnection(connection, errorMessage)) {
      return false;
    }
    return true;
  }

  bool syncConnectionById(int connectionId, string &errorMessage,
                          int &failureStatus) {
    failureStatus = 0;
    auto optConnection = store.getConnectionById(connectionId, errorMessage);
    if (!optConnection) {
      errorMessage = "Instagram connection not found";
      return false;
    }
    InstagramConnectionRecord connection = *optConnection;
    if (connection.status != "active") {
      errorMessage = "Instagram connection is not active";
      return false;
    }

    auto tokenOpt = cipher.decrypt(connection.tokenEncrypted, errorMessage);
    if (!tokenOpt) {
      return false;
    }
    string token = *tokenOpt;

    if (!refreshLongLivedTokenIfNeeded(connection, token, errorMessage,
                                       failureStatus)) {
      store.updateConnectionSyncMetadata(connection.id, nowUnixSeconds(),
                                         "sync_error", errorMessage);
      return false;
    }

    string igUserId;
    string igUsername;
    if (!fetchInstagramProfile(token, igUserId, igUsername, errorMessage,
                               failureStatus)) {
      store.updateConnectionSyncMetadata(connection.id, nowUnixSeconds(),
                                         "sync_error", errorMessage);
      return false;
    }

    if (connection.igUserId != igUserId || connection.igUsername != igUsername) {
      connection.igUserId = igUserId;
      connection.igUsername = igUsername;
      string upsertErr;
      store.upsertInstagramConnection(connection, upsertErr);
    }

    string mediaListUrl = "https://graph.instagram.com/" + igVersion + "/" +
                          urlEncode(igUserId) + "/media?access_token=" +
                          urlEncode(token);
    HttpResult listRes = httpGetUrl(mediaListUrl);
    failureStatus = listRes.status;
    if (listRes.status < 200 || listRes.status >= 300) {
      errorMessage = "Failed to list media (" + to_string(listRes.status) + ")";
      store.updateConnectionSyncMetadata(connection.id, nowUnixSeconds(),
                                         "sync_error", errorMessage);
      return false;
    }

    vector<string> rawIds = extractAllJSONFieldValues(listRes.body, "id");
    vector<string> mediaIds;
    for (const string &id : rawIds) {
      if (!id.empty() && isdigit(static_cast<unsigned char>(id[0])) &&
          id.size() >= 10) {
        mediaIds.push_back(id);
      }
    }
    sort(mediaIds.begin(), mediaIds.end());
    mediaIds.erase(unique(mediaIds.begin(), mediaIds.end()), mediaIds.end());
    if (mediaIds.size() > 200) {
      mediaIds.resize(200);
    }

    vector<string> activeIds;
    for (const string &igMediaId : mediaIds) {
      string detailUrl = "https://graph.instagram.com/" + igVersion + "/" +
                         urlEncode(igMediaId) +
                         "?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,username&access_token=" +
                         urlEncode(token);
      HttpResult detailRes = httpGetUrl(detailUrl);
      if (detailRes.status < 200 || detailRes.status >= 300) {
        if (isTokenServerError(detailRes.status)) {
          failureStatus = detailRes.status;
        }
        continue;
      }

      auto id = extractJSONString(detailRes.body, "id");
      if (!id) continue;
      InstagramMediaRecord record;
      record.igMediaId = *id;
      record.connectionId = connection.id;
      record.mediaType = extractJSONString(detailRes.body, "media_type").value_or("");
      record.caption = extractJSONString(detailRes.body, "caption").value_or("");
      record.permalink = extractJSONString(detailRes.body, "permalink").value_or("");
      record.timestamp =
          extractJSONString(detailRes.body, "timestamp").value_or(getCurrentUtcIsoTimestamp());
      record.mediaUrl = extractJSONString(detailRes.body, "media_url").value_or("");
      record.thumbnailUrl = extractJSONString(detailRes.body, "thumbnail_url").value_or("");
      record.rawJson = detailRes.body;
      record.isActive = true;

      string cacheErr;
      if (toLowerCopy(record.mediaType) == "image" && !record.mediaUrl.empty()) {
        string cachedUrl;
        string key;
        if (cacheAssetIfConfigured(igUserId, record.igMediaId, "main",
                                   record.mediaUrl, cachedUrl, key, cacheErr)) {
          record.mediaUrl = cachedUrl;
          record.r2Key = key;
        }
      } else if (!record.thumbnailUrl.empty()) {
        string cachedThumb;
        string thumbKey;
        if (cacheAssetIfConfigured(igUserId, record.igMediaId, "thumb",
                                   record.thumbnailUrl, cachedThumb, thumbKey,
                                   cacheErr)) {
          record.thumbnailUrl = cachedThumb;
          record.r2ThumbKey = thumbKey;
        }
      }

      string upsertError;
      if (!store.upsertInstagramMedia(record, upsertError)) {
        errorMessage = upsertError;
        continue;
      }
      activeIds.push_back(record.igMediaId);
    }

    if (!store.deactivateMissingMedia(connection.id, activeIds, errorMessage)) {
      store.updateConnectionSyncMetadata(connection.id, nowUnixSeconds(),
                                         "sync_error", errorMessage);
      return false;
    }

    string statusError;
    if (!store.updateConnectionSyncMetadata(connection.id, nowUnixSeconds(),
                                            "active", statusError)) {
      errorMessage = statusError;
      return false;
    }

    return true;
  }
};

class SyncWorker {
private:
  InMemoryStore &store;
  InstagramIntegrationService &instagramService;
  thread worker;
  atomic<bool> stopFlag{false};
  mutex cvMutex;
  condition_variable cv;
  unordered_map<int, int> failureCount;
  unordered_map<int, long long> nextAllowedSyncAt;

public:
  SyncWorker(InMemoryStore &storeRef, InstagramIntegrationService &serviceRef)
      : store(storeRef), instagramService(serviceRef) {}

  ~SyncWorker() { stop(); }

  void start() {
    worker = thread([this]() {
      mt19937 rng(static_cast<unsigned int>(time(nullptr)));
      uniform_int_distribution<int> loopJitter(0, 30);

      while (!stopFlag.load()) {
        string errorMessage;
        vector<InstagramConnectionRecord> connections =
            store.listConnections(errorMessage);
        long long now = nowUnixSeconds();

        for (const auto &connection : connections) {
          if (stopFlag.load()) break;
          if (connection.status != "active") continue;

          long long allowedAt = 0;
          auto it = nextAllowedSyncAt.find(connection.id);
          if (it != nextAllowedSyncAt.end()) {
            allowedAt = it->second;
          }
          if (allowedAt > now) {
            continue;
          }

          string syncError;
          int failureStatus = 0;
          bool ok = instagramService.syncConnectionById(connection.id, syncError,
                                                        failureStatus);
          if (ok) {
            failureCount.erase(connection.id);
            nextAllowedSyncAt.erase(connection.id);
            cout << "[sync] connection " << connection.id << " synced successfully"
                 << endl;
          } else {
            int count = ++failureCount[connection.id];
            int backoffBase = min(3600, 15 * (1 << min(count, 7)));
            int jitter = uniform_int_distribution<int>(0, 20)(rng);
            int backoff = backoffBase + jitter;
            nextAllowedSyncAt[connection.id] = now + backoff;
            cout << "[sync] connection " << connection.id
                 << " failed. backoffSeconds=" << backoff
                 << " status=" << failureStatus
                 << " error=" << syncError << endl;
          }
        }

        unique_lock<mutex> lock(cvMutex);
        cv.wait_for(lock, chrono::minutes(15) + chrono::seconds(loopJitter(rng)),
                    [this]() { return stopFlag.load(); });
      }
    });
  }

  void stop() {
    if (!worker.joinable()) {
      return;
    }
    stopFlag.store(true);
    cv.notify_all();
    worker.join();
  }
};

struct FeedMediaItem {
  string type;
  string url;
  string thumbnailUrl;
};

struct FeedItem {
  string id;
  string source;
  bool readOnly = false;
  string authorUserName;
  string authorDisplayName;
  string authorAvatarUrl;
  string caption;
  string createdAt;
  string permalink;
  vector<FeedMediaItem> media;
};

string buildFeedItemJSON(const FeedItem &item) {
  string json = "{";
  json += "\"id\":\"" + jsonEscape(item.id) + "\",";
  json += "\"source\":\"" + jsonEscape(item.source) + "\",";
  json += "\"readOnly\":" + boolToJSON(item.readOnly) + ",";
  json += "\"author\":{";
  json += "\"userName\":\"" + jsonEscape(item.authorUserName) + "\",";
  json += "\"displayName\":\"" + jsonEscape(item.authorDisplayName) + "\",";
  json += "\"avatarUrl\":\"" + jsonEscape(item.authorAvatarUrl) + "\"";
  json += "},";
  json += "\"caption\":\"" + jsonEscape(item.caption) + "\",";
  json += "\"createdAt\":\"" + jsonEscape(item.createdAt) + "\",";
  json += "\"permalink\":\"" + jsonEscape(item.permalink) + "\",";
  json += "\"media\":[";
  for (size_t i = 0; i < item.media.size(); i++) {
    const FeedMediaItem &media = item.media[i];
    json += "{";
    json += "\"type\":\"" + jsonEscape(media.type) + "\",";
    json += "\"url\":\"" + jsonEscape(media.url) + "\",";
    json += "\"thumbnailUrl\":\"" + jsonEscape(media.thumbnailUrl) + "\"";
    json += "}";
    if (i + 1 < item.media.size()) {
      json += ",";
    }
  }
  json += "]";
  json += "}";
  return json;
}

optional<pair<string, string>> decodeFeedCursor(const string &cursorRaw) {
  if (cursorRaw.empty()) {
    return nullopt;
  }
  string cursor = urlDecode(cursorRaw);
  size_t delimiter = cursor.find('|');
  if (delimiter == string::npos) {
    return nullopt;
  }
  return make_pair(cursor.substr(0, delimiter), cursor.substr(delimiter + 1));
}

string buildFeedCursor(const FeedItem &item) {
  return urlEncode(item.createdAt + "|" + item.id);
}

// ============================================
// MAIN
// ============================================
int main() {
  srand(static_cast<unsigned int>(time(nullptr)));

  httplib::Server server;

  SocialNetwork *ericGram = new SocialNetwork();
  ericGram->addUser(new User("ericphXm", "Eric Pham", 4089089824LL,
                             "ericpham0902@gmail.com", "password123",
                             "ericpham"));
  ericGram->addUser(new User("alice123", "Alice Smith", 1234567890LL,
                             "alice@email.com", "password123"));
  ericGram->addUser(new User("bob456", "Bob Johnson", 9876543210LL,
                             "bob@email.com", "mypassword"));
  ericGram->addUser(new User("charlie789", "Charlie Brown", 5555555555LL,
                             "charlie@email.com", "secret123"));
  ericGram->addUser(new User("beltran", "Beltran", 4089089824LL,
                             "jaymanigorman@gmail.com", "password123",
                             "beltran", "/assets/beltran.jpg"));
  ericGram->addUser(new User("Ebkjaaybo", "👁️ 4k 👁️ #DONTTRUSTME", 4089089824LL,
                             "jaymanigorman@gmail.com", "password123",
                             "ebkjaaybo", "/assets/ebkjaaybo.jpg"));
  ericGram->addUser(new User("ragieban", "RAGIE BAN", 1112223333LL,
                             "ragie@ban.com", "house123", "ragieban"));
  ericGram->addUser(new User("mochakk", "MOCHAKK", 4445556666LL,
                             "mochakk@house.com", "brazil123", "mochakk"));
  ericGram->addUser(new User("officialgreenvelvet", "Green Velvet",
                             7778889999LL, "green@velvet.com", "chicago123",
                             "officialgreenvelvet"));
  ericGram->addUser(new User("chasewest", "Chase West", 1212121212LL,
                             "chase@west.com", "tech123", "chasewest"));
  ericGram->addUser(new User("johnsummit", "John Summit", 3434343434LL,
                             "john@summit.com", "vibe123", "johnsummit"));
  const string demoEmail = "averagejoe@emaill.com";
  if (!ericGram->findUserByEmail(demoEmail)) {
    ericGram->addUser(new User("averagejoe", "Average Joe", 1010101010LL,
                               demoEmail, "1234", "averagejoe"));
  }

  InMemoryStore store;

  TokenCipher tokenCipher(getEnvOrDefault("IG_TOKEN_ENC_KEY", "dev-only-change-me"));
  InstagramIntegrationService instagramService(store, tokenCipher);
  SyncWorker syncWorker(store, instagramService);
  syncWorker.start();

  unordered_set<string> adminUsers = {"ericphXm"};
  for (const auto &entry : splitCSV(getEnvOrDefault("ADMIN_USERNAMES", ""))) {
    if (!entry.empty()) {
      adminUsers.insert(entry);
    }
  }

  const string sessionCookieName = "ericgram_session";
  const bool secureCookies =
      getEnvBool("COOKIE_SECURE", toLowerCopy(getEnvOrDefault("ERICGRAM_ENV", "development")) == "production");
  const string frontendBaseUrl =
      getEnvOrDefault("FRONTEND_BASE_URL", "http://localhost:5176");

  auto setCorsHeaders = [](const httplib::Request &req, httplib::Response &res) {
    string origin = req.get_header_value("Origin");
    if (!origin.empty()) {
      res.set_header("Access-Control-Allow-Origin", origin);
      res.set_header("Vary", "Origin");
      res.set_header("Access-Control-Allow-Credentials", "true");
    } else {
      res.set_header("Access-Control-Allow-Origin", "*");
    }
    res.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, X-Auth-User");
  };

  auto makeSessionCookie = [&](const string &sessionId, long long maxAgeSeconds) {
    string cookie = sessionCookieName + "=" + sessionId + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
                    to_string(maxAgeSeconds);
    if (secureCookies) {
      cookie += "; Secure";
    }
    return cookie;
  };

  auto makeClearedSessionCookie = [&]() {
    string cookie = sessionCookieName +
                    "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
    if (secureCookies) {
      cookie += "; Secure";
    }
    return cookie;
  };

  auto loadSessionFromRequest = [&](const httplib::Request &req,
                                    SessionRecord &outSession) -> bool {
    string cookieHeader = req.get_header_value("Cookie");
    if (cookieHeader.empty()) {
      return false;
    }
    auto cookies = parseCookies(cookieHeader);
    auto it = cookies.find(sessionCookieName);
    if (it == cookies.end() || it->second.empty()) {
      return false;
    }
    string errorMessage;
    auto sessionOpt = store.getSession(it->second, errorMessage);
    if (!sessionOpt) {
      return false;
    }
    outSession = *sessionOpt;
    return true;
  };

  auto requireSession = [&](const httplib::Request &req, httplib::Response &res,
                            SessionRecord &session) -> bool {
    if (!loadSessionFromRequest(req, session)) {
      setJsonError(res, 401, "Authentication required");
      return false;
    }
    return true;
  };

  auto requireAdmin = [&](const httplib::Request &req, httplib::Response &res,
                          SessionRecord &session) -> bool {
    if (!requireSession(req, res, session)) {
      return false;
    }
    if (session.role != "admin") {
      setJsonError(res, 403, "Admin role required");
      return false;
    }
    return true;
  };

  auto authorizeActor = [ericGram](const httplib::Request &req,
                                   httplib::Response &res,
                                   const string &actorUserName) {
    string authUser = req.get_header_value("X-Auth-User");
    if (authUser.empty()) {
      setJsonError(res, 401, "Missing X-Auth-User header");
      return false;
    }
    if (!ericGram->findUser(authUser)) {
      setJsonError(res, 401, "Invalid X-Auth-User");
      return false;
    }
    if (authUser != actorUserName) {
      setJsonError(res, 403, "X-Auth-User must match request actor");
      return false;
    }
    return true;
  };

  server.Options(R"(/api/.*)", [setCorsHeaders](const httplib::Request &req,
                                                  httplib::Response &res) {
    setCorsHeaders(req, res);
    res.status = 200;
  });

  server.Post("/api/auth/login", [ericGram, &store, &adminUsers, &makeSessionCookie,
                                   setCorsHeaders](const httplib::Request &req,
                                                   httplib::Response &res) {
    setCorsHeaders(req, res);
    string email = trimCopy(getJSONValue(req.body, "email"));
    string password = getJSONValue(req.body, "password");
    User *user = ericGram->findUserByEmail(email);
    if (!user || !user->checkPassword(password)) {
      setJsonError(res, 401, "Invalid email or password");
      return;
    }

    SessionRecord session;
    session.sessionId = randomHex(24);
    session.userName = user->userName;
    session.role = adminUsers.count(user->userName) > 0 ? "admin" : "user";
    session.csrfToken = randomHex(16);
    session.expiresAt = nowUnixSeconds() + SESSION_TTL_SECONDS;

    string errorMessage;
    if (!store.upsertSession(session, errorMessage)) {
      setJsonError(res, 500, "Could not create session");
      return;
    }
    res.set_header("Set-Cookie",
                   makeSessionCookie(session.sessionId, SESSION_TTL_SECONDS));
    res.set_content("{\"user\":" + user->toJSON() + ",\"role\":\"" +
                        jsonEscape(session.role) + "\",\"sessionExpiresAt\":" +
                        to_string(session.expiresAt) + "}",
                    "application/json");
  });

  server.Get("/api/auth/me", [ericGram, &store, &makeSessionCookie, requireSession,
                               setCorsHeaders](const httplib::Request &req,
                                               httplib::Response &res) {
    setCorsHeaders(req, res);
    SessionRecord session;
    if (!requireSession(req, res, session)) {
      return;
    }
    User *user = ericGram->findUser(session.userName);
    if (!user) {
      string errorMessage;
      store.deleteSession(session.sessionId, errorMessage);
      setJsonError(res, 401, "Session user no longer exists");
      return;
    }

    session.expiresAt = nowUnixSeconds() + SESSION_TTL_SECONDS;
    string errorMessage;
    store.upsertSession(session, errorMessage);
    res.set_header("Set-Cookie",
                   makeSessionCookie(session.sessionId, SESSION_TTL_SECONDS));
    res.set_content("{\"user\":" + user->toJSON() + ",\"role\":\"" +
                        jsonEscape(session.role) + "\",\"sessionExpiresAt\":" +
                        to_string(session.expiresAt) + "}",
                    "application/json");
  });

  server.Post("/api/auth/logout", [&store, &makeClearedSessionCookie,
                                    setCorsHeaders](const httplib::Request &req,
                                                    httplib::Response &res) {
    setCorsHeaders(req, res);
    string cookieHeader = req.get_header_value("Cookie");
    if (!cookieHeader.empty()) {
      auto cookies = parseCookies(cookieHeader);
      auto it = cookies.find("ericgram_session");
      if (it != cookies.end() && !it->second.empty()) {
        string errorMessage;
        store.deleteSession(it->second, errorMessage);
      }
    }
    res.set_header("Set-Cookie", makeClearedSessionCookie());
    res.set_content("{\"status\":\"logged_out\"}", "application/json");
  });

  // Backwards-compatible local login for legacy frontend.
  server.Post("/api/login", [ericGram, setCorsHeaders](const httplib::Request &req,
                                                        httplib::Response &res) {
    setCorsHeaders(req, res);
    string email = getJSONValue(req.body, "email");
    string password = getJSONValue(req.body, "password");

    User *user = ericGram->findUserByEmail(email);
    if (!user || !user->checkPassword(password)) {
      setJsonError(res, 401, "Invalid email or password");
      return;
    }
    res.set_content(user->toJSON(), "application/json");
  });

  server.Post("/api/signup", [ericGram, setCorsHeaders](const httplib::Request &req,
                                                         httplib::Response &res) {
    setCorsHeaders(req, res);

    string userName = trimCopy(getJSONValue(req.body, "userName"));
    string name = trimCopy(getJSONValue(req.body, "name"));
    string phoneNumberRaw = trimCopy(getJSONValue(req.body, "phoneNumber"));
    string email = trimCopy(getJSONValue(req.body, "email"));
    string password = getJSONValue(req.body, "password");
    string instagramHandle = trimCopy(getJSONValue(req.body, "instagramHandle"));
    string profilePic = trimCopy(getJSONValue(req.body, "profilePic"));

    long long phoneNumber = 0;
    try {
      phoneNumber = stoll(phoneNumberRaw);
    } catch (...) {
      setJsonError(res, 400, "phoneNumber must be a valid integer string");
      return;
    }

    User *createdUser = nullptr;
    string errorMessage;
    int errorStatus = 400;
    if (!ericGram->createUser(userName, name, phoneNumber, email, password,
                              instagramHandle, profilePic, createdUser,
                              errorMessage, errorStatus)) {
      setJsonError(res, errorStatus, errorMessage);
      return;
    }

    res.set_content(createdUser->toJSON(), "application/json");
  });

  server.Post("/api/admin/instagram/oauth/start",
              [&store, &instagramService, requireSession, setCorsHeaders](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);
                SessionRecord session;
                if (!requireSession(req, res, session)) {
                  return;
                }
                if (!instagramService.isConfigured()) {
                  setJsonError(res, 500,
                               "Instagram integration is not configured");
                  return;
                }

                string state = randomHex(20);
                string errorMessage;
                if (!store.updateSessionCsrfToken(session.sessionId, state,
                                                  errorMessage)) {
                  setJsonError(res, 500, "Failed to update CSRF state");
                  return;
                }
                string authUrl = instagramService.buildOAuthAuthorizationUrl(state);
                res.set_content("{\"authorizationUrl\":\"" + jsonEscape(authUrl) +
                                    "\"}",
                                "application/json");
              });

  server.Get("/api/admin/instagram/oauth/callback",
             [&store, &instagramService, requireSession, frontendBaseUrl, setCorsHeaders](
                 const httplib::Request &req, httplib::Response &res) {
               setCorsHeaders(req, res);
               SessionRecord session;
               if (!requireSession(req, res, session)) {
                 return;
               }

               string redirect = frontendBaseUrl + "/";
               string deniedError = req.get_param_value("error");
               if (!deniedError.empty()) {
                 res.status = 302;
                 res.set_header("Location", redirect + "?instagram_error=" +
                                               urlEncode(deniedError));
                 return;
               }

               string code = req.get_param_value("code");
               string state = req.get_param_value("state");
               if (code.empty() || state.empty()) {
                 res.status = 302;
                 res.set_header(
                     "Location",
                     redirect + "?instagram_error=missing_code_or_state");
                 return;
               }

               if (state != session.csrfToken) {
                 res.status = 302;
                 res.set_header(
                     "Location",
                     redirect + "?instagram_error=csrf_state_mismatch");
                 return;
               }

               InstagramConnectionRecord connection;
               string errorMessage;
               if (!instagramService.exchangeCodeAndStoreConnection(
                       code, connection, errorMessage)) {
                 res.status = 302;
                 res.set_header("Location", redirect + "?instagram_error=" +
                                               urlEncode(errorMessage));
                 return;
               }

               int failureStatus = 0;
               string syncError;
               instagramService.syncConnectionById(connection.id, syncError,
                                                   failureStatus);

               res.status = 302;
               res.set_header("Location",
                              redirect + "?instagram_connected=1&connectionId=" +
                                  to_string(connection.id));
             });

  server.Get("/api/admin/instagram/connections",
             [&store, requireSession, setCorsHeaders](const httplib::Request &req,
                                                    httplib::Response &res) {
               setCorsHeaders(req, res);
               SessionRecord session;
               if (!requireSession(req, res, session)) {
                 return;
               }
               string errorMessage;
               vector<InstagramConnectionRecord> connections =
                   store.listConnections(errorMessage);

               string json = "{\"items\":[";
               for (size_t i = 0; i < connections.size(); i++) {
                 const auto &connection = connections[i];
                 json += "{";
                 json += "\"id\":" + to_string(connection.id) + ",";
                 json += "\"igUserId\":\"" + jsonEscape(connection.igUserId) + "\",";
                 json += "\"igUsername\":\"" + jsonEscape(connection.igUsername) + "\",";
                 json += "\"tokenExpiresAt\":" + to_string(connection.tokenExpiresAt) + ",";
                 json += "\"scopes\":\"" + jsonEscape(connection.scopes) + "\",";
                 json += "\"lastSyncAt\":" + to_string(connection.lastSyncAt) + ",";
                 json += "\"status\":\"" + jsonEscape(connection.status) + "\"";
                 json += "}";
                 if (i + 1 < connections.size()) json += ",";
               }
               json += "]}";
               res.set_content(json, "application/json");
             });

  server.Post(R"(/api/admin/instagram/connections/(\d+)/sync)",
              [&instagramService, requireSession, setCorsHeaders](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);
                SessionRecord session;
                if (!requireSession(req, res, session)) {
                  return;
                }
                int connectionId = stoi(req.matches[1]);
                string errorMessage;
                int failureStatus = 0;
                if (!instagramService.syncConnectionById(connectionId, errorMessage,
                                                         failureStatus)) {
                  setJsonError(res, 500, "Sync failed: " + errorMessage);
                  return;
                }
                res.set_content("{\"status\":\"synced\",\"connectionId\":" +
                                    to_string(connectionId) + "}",
                                "application/json");
              });

  server.Delete(R"(/api/admin/instagram/connections/(\d+))",
                [&store, requireSession, setCorsHeaders](const httplib::Request &req,
                                                       httplib::Response &res) {
                  setCorsHeaders(req, res);
                  SessionRecord session;
                  if (!requireSession(req, res, session)) {
                    return;
                  }
                  int connectionId = stoi(req.matches[1]);
                  string errorMessage;
                  if (!store.deleteConnection(connectionId, errorMessage)) {
                    setJsonError(res, 500, "Delete failed: " + errorMessage);
                    return;
                  }
                  res.set_content("{\"status\":\"deleted\",\"connectionId\":" +
                                      to_string(connectionId) + "}",
                                  "application/json");
                });

  server.Get("/api/feed", [&store, setCorsHeaders](const httplib::Request &req,
                                                    httplib::Response &res) {
    setCorsHeaders(req, res);
    int limit = parsePositiveIntOrDefault(req.get_param_value("limit"), FEED_DEFAULT_LIMIT);
    if (limit > FEED_MAX_LIMIT) limit = FEED_MAX_LIMIT;
    if (limit <= 0) limit = FEED_DEFAULT_LIMIT;
    string cursorRaw = req.get_param_value("cursor");
    optional<pair<string, string>> cursor = decodeFeedCursor(cursorRaw);
    string sourceFilter = toLowerCopy(trimCopy(req.get_param_value("source")));
    if (!sourceFilter.empty() && sourceFilter != "all" &&
        sourceFilter != "instagram") {
      if (sourceFilter == "local") {
        setJsonError(res, 400,
                     "Local feed media is disabled. Use source=instagram.");
      } else {
        setJsonError(res, 400,
                     "Invalid source filter. Use all or instagram.");
      }
      return;
    }

    vector<FeedItem> allItems;
    string dbError;
    vector<InstagramMediaRecord> igMedia = store.listActiveInstagramMedia(dbError);
    for (const auto &record : igMedia) {
      FeedItem item;
      item.id = "ig:" + record.igMediaId;
      item.source = "instagram";
      item.readOnly = true;
      item.authorUserName =
          extractJSONString(record.rawJson, "username").value_or("instagram");
      item.authorDisplayName = item.authorUserName;
      item.authorAvatarUrl = "";
      item.caption = record.caption;
      item.createdAt = record.timestamp.empty() ? getCurrentUtcIsoTimestamp()
                                                : record.timestamp;
      item.permalink = record.permalink;

      FeedMediaItem mediaItem;
      mediaItem.type =
          toLowerCopy(record.mediaType) == "video" ? "video" : "image";
      mediaItem.url = record.mediaUrl;
      mediaItem.thumbnailUrl = record.thumbnailUrl;
      if (!mediaItem.url.empty()) {
        item.media.push_back(mediaItem);
      }
      allItems.push_back(item);
    }

    sort(allItems.begin(), allItems.end(),
         [](const FeedItem &a, const FeedItem &b) {
           if (a.createdAt == b.createdAt) {
             return a.id > b.id;
           }
           return a.createdAt > b.createdAt;
         });

    vector<FeedItem> filtered;
    filtered.reserve(allItems.size());
    for (const auto &item : allItems) {
      if (cursor) {
        const string &cursorCreatedAt = cursor->first;
        const string &cursorId = cursor->second;
        bool isOlder = item.createdAt < cursorCreatedAt ||
                       (item.createdAt == cursorCreatedAt && item.id < cursorId);
        if (!isOlder) {
          continue;
        }
      }
      filtered.push_back(item);
    }

    bool hasMore = static_cast<int>(filtered.size()) > limit;
    if (hasMore) {
      filtered.resize(limit);
    }

    string nextCursor = "";
    if (hasMore && !filtered.empty()) {
      nextCursor = buildFeedCursor(filtered.back());
    }

    string json = "{";
    json += "\"items\":[";
    for (size_t i = 0; i < filtered.size(); i++) {
      json += buildFeedItemJSON(filtered[i]);
      if (i + 1 < filtered.size()) json += ",";
    }
    json += "],";
    json += "\"nextCursor\":\"" + jsonEscape(nextCursor) + "\",";
    json += "\"hasMore\":" + boolToJSON(hasMore);
    json += "}";
    res.set_content(json, "application/json");
  });

  server.Get("/api/users",
             [ericGram, setCorsHeaders](const httplib::Request &req,
                                        httplib::Response &res) {
               setCorsHeaders(req, res);
               res.set_content(ericGram->getAllUsersJSON(), "application/json");
             });

  server.Post("/api/friends/add", [ericGram, setCorsHeaders](
                                       const httplib::Request &req,
                                       httplib::Response &res) {
    setCorsHeaders(req, res);

    string userName = getJSONValue(req.body, "userName");
    string friendUserName = getJSONValue(req.body, "friendUserName");

    User *user = ericGram->findUser(userName);
    User *friendUser = ericGram->findUser(friendUserName);

    if (!user || !friendUser) {
      setJsonError(res, 404, "User not found");
      return;
    }

    if (user->isFriend(friendUserName)) {
      setJsonError(res, 400, "Already friends");
      return;
    }

    user->addFriend(friendUser);
    friendUser->addFriend(user);

    res.set_content(user->toJSON(), "application/json");
  });

  server.Post("/api/messages/send", [ericGram, setCorsHeaders](
                                         const httplib::Request &req,
                                         httplib::Response &res) {
    setCorsHeaders(req, res);

    string from = getJSONValue(req.body, "from");
    string to = getJSONValue(req.body, "to");
    string text = getJSONValue(req.body, "text");

    if (!ericGram->findUser(from) || !ericGram->findUser(to)) {
      setJsonError(res, 404, "User not found");
      return;
    }

    Message *msg = new Message();
    msg->fromUser = from;
    msg->toUser = to;
    msg->text = text;
    msg->timestamp = getCurrentUtcIsoTimestamp();
    ericGram->addMessage(msg);

    res.set_content("{\"status\":\"sent\"}", "application/json");
  });

  server.Get("/api/messages",
             [ericGram, setCorsHeaders](const httplib::Request &req,
                                        httplib::Response &res) {
               setCorsHeaders(req, res);

               string user1 = req.get_param_value("user1");
               string user2 = req.get_param_value("user2");

               res.set_content(ericGram->getConversationJSON(user1, user2),
                               "application/json");
             });

  server.Post("/api/posts/create",
              [ericGram, setCorsHeaders, authorizeActor](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);

                if (!req.is_multipart_form_data()) {
                  setJsonError(res, 400, "Expected multipart/form-data");
                  return;
                }

                string authorUserName = req.form.get_field("authorUserName");
                string caption = req.form.get_field("caption");

                if (!authorizeActor(req, res, authorUserName)) {
                  return;
                }

                vector<httplib::FormData> files = req.form.get_files("mediaFiles");
                string createdPostId;
                string errorMessage;
                int errorStatus = 400;
                if (!ericGram->addUploadedPost(authorUserName, caption, files,
                                               createdPostId, errorMessage,
                                               errorStatus)) {
                  setJsonError(res, errorStatus, errorMessage);
                  return;
                }

                res.set_content("{\"status\":\"created\",\"post\":" +
                                    ericGram->getPostJSONById(createdPostId, authorUserName) +
                                    "}",
                                "application/json");
              });

  server.Get("/api/posts",
             [ericGram, setCorsHeaders](const httplib::Request &req,
                                        httplib::Response &res) {
               setCorsHeaders(req, res);
               string viewer = req.get_param_value("viewer");
               if (viewer.empty() || !ericGram->findUser(viewer)) {
                 setJsonError(res, 401, "Valid viewer is required");
                 return;
               }
               int page = parsePositiveIntOrDefault(req.get_param_value("page"), 1);
               int limit =
                   parsePositiveIntOrDefault(req.get_param_value("limit"), 10);
               if (limit > 50) limit = 50;
               string q = req.get_param_value("q");
               res.set_content(ericGram->getPostsPageJSON(page, limit, q, viewer),
                               "application/json");
             });

  server.Get("/api/posts/media",
             [ericGram, setCorsHeaders](const httplib::Request &req,
                                        httplib::Response &res) {
               setCorsHeaders(req, res);
               string mediaId = req.get_param_value("mediaId");
               const MediaAsset *mediaAsset = ericGram->findMediaAsset(mediaId);
               if (!mediaAsset) {
                 setJsonError(res, 404, "Media not found");
                 return;
               }
               res.set_content(mediaAsset->bytes, mediaAsset->mimeType);
             });

  server.Post("/api/posts/like",
              [ericGram, setCorsHeaders, authorizeActor](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);
                string postId = getJSONValue(req.body, "postId");
                string actorUserName = getJSONValue(req.body, "actorUserName");

                if (!authorizeActor(req, res, actorUserName)) {
                  return;
                }

                bool alreadyLiked = false;
                string errorMessage;
                int errorStatus = 400;
                if (!ericGram->likePost(postId, actorUserName, alreadyLiked,
                                        errorMessage, errorStatus)) {
                  setJsonError(res, errorStatus, errorMessage);
                  return;
                }

                res.set_content("{\"status\":\"ok\",\"alreadyLiked\":" +
                                    boolToJSON(alreadyLiked) +
                                    ",\"post\":" +
                                    ericGram->getPostJSONById(postId, actorUserName) +
                                    "}",
                                "application/json");
              });

  server.Post("/api/posts/comment/add",
              [ericGram, setCorsHeaders, authorizeActor](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);
                if (!req.is_multipart_form_data()) {
                  setJsonError(res, 400, "Expected multipart/form-data");
                  return;
                }
                string postId = req.form.get_field("postId");
                string actorUserName = req.form.get_field("actorUserName");
                string text = req.form.get_field("text");

                if (!authorizeActor(req, res, actorUserName)) {
                  return;
                }

                string errorMessage;
                int errorStatus = 400;
                if (!ericGram->addCommentToPost(postId, actorUserName, text,
                                                errorMessage, errorStatus)) {
                  setJsonError(res, errorStatus, errorMessage);
                  return;
                }

                res.set_content("{\"status\":\"ok\",\"post\":" +
                                    ericGram->getPostJSONById(postId, actorUserName) +
                                    "}",
                                "application/json");
              });

  server.Post("/api/posts/comment/edit",
              [ericGram, setCorsHeaders, authorizeActor](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);
                if (!req.is_multipart_form_data()) {
                  setJsonError(res, 400, "Expected multipart/form-data");
                  return;
                }
                string postId = req.form.get_field("postId");
                string commentId = req.form.get_field("commentId");
                string actorUserName = req.form.get_field("actorUserName");
                string text = req.form.get_field("text");

                if (!authorizeActor(req, res, actorUserName)) {
                  return;
                }

                string errorMessage;
                int errorStatus = 400;
                if (!ericGram->editCommentOnPost(postId, commentId, actorUserName,
                                                 text, errorMessage,
                                                 errorStatus)) {
                  setJsonError(res, errorStatus, errorMessage);
                  return;
                }

                res.set_content("{\"status\":\"ok\",\"post\":" +
                                    ericGram->getPostJSONById(postId, actorUserName) +
                                    "}",
                                "application/json");
              });

  server.Post("/api/posts/comment/delete",
              [ericGram, setCorsHeaders, authorizeActor](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);
                string postId = getJSONValue(req.body, "postId");
                string commentId = getJSONValue(req.body, "commentId");
                string actorUserName = getJSONValue(req.body, "actorUserName");

                if (!authorizeActor(req, res, actorUserName)) {
                  return;
                }

                string errorMessage;
                int errorStatus = 400;
                if (!ericGram->deleteCommentFromPost(postId, commentId,
                                                     actorUserName, errorMessage,
                                                     errorStatus)) {
                  setJsonError(res, errorStatus, errorMessage);
                  return;
                }

                res.set_content("{\"status\":\"ok\",\"post\":" +
                                    ericGram->getPostJSONById(postId, actorUserName) +
                                    "}",
                                "application/json");
              });

  server.Post("/api/posts/delete",
              [ericGram, setCorsHeaders, authorizeActor](
                  const httplib::Request &req, httplib::Response &res) {
                setCorsHeaders(req, res);
                string postId = getJSONValue(req.body, "postId");
                string actorUserName = getJSONValue(req.body, "actorUserName");
                if (!authorizeActor(req, res, actorUserName)) {
                  return;
                }
                string errorMessage;
                int errorStatus = 400;
                if (!ericGram->deletePostById(postId, actorUserName, errorMessage,
                                              errorStatus)) {
                  setJsonError(res, errorStatus, errorMessage);
                  return;
                }
                res.set_content("{\"status\":\"deleted\",\"postId\":\"" +
                                    jsonEscape(postId) + "\"}",
                                "application/json");
              });

  string host = getEnvOrDefault("HOST", "0.0.0.0");
  int port = parsePositiveIntOrDefault(getEnvOrDefault("PORT", "8080"), 8080);

  cout << "Server starting on http://" << host << ":" << port << endl;
  server.listen(host.c_str(), port);

  syncWorker.stop();
  delete ericGram;
  return 0;
}
