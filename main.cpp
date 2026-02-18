#include "include/httplib.h"
#include <algorithm> // for std::transform (used in toLower)
#include <iostream>
#include <string>
#include <vector>

using namespace std;

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

  // Add a friend to this user's friends list
  void addFriend(User *newFriend) { friends->push_back(newFriend); }
  vector<User *> *getFriendsOfUser() const { return friends; }

  // Check if a given user is already in this user's friends list
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

  // Convert to JSON for sending to frontend (c++ objects -> json string)
  string toJSON() const {
    string json = "{";
    json += "\"userName\":\"" + userName + "\",";
    json += "\"name\":\"" + name + "\",";
    json += "\"instagramHandle\":\"" + instagramHandle + "\",";
    json += "\"profilePic\":\"" + profilePic + "\",";
    json += "\"email\":\"" + email + "\",";
    json += "\"friendsCount\":" + to_string(friends->size());

    // Include friends list as array of usernames
    json += ",\"friends\":[";
    for (size_t i = 0; i < friends->size(); i++) {
      json += "\"" + friends->at(i)->getIdOfUser() + "\"";
      if (i < friends->size() - 1)
        json += ",";
    }
    json += "]";

    json += "}";
    return json;
  }
};

// ============================================
// MESSAGE STRUCT — stores a single chat message
// ============================================
struct Message {
  string fromUser;  // userName of sender
  string toUser;    // userName of recipient
  string text;      // the message content
  string timestamp; // when it was sent (e.g., "10:30 PM")

  // Convert message to JSON for sending to frontend
  string toJSON() const {
    string json = "{";
    json += "\"from\":\"" + fromUser + "\",";
    json += "\"to\":\"" + toUser + "\",";
    json += "\"text\":\"" + text + "\",";
    json += "\"timestamp\":\"" + timestamp + "\"";
    json += "}";
    return json;
  }
};

// ============================================
// SOCIAL NETWORK CLASS - Your "database"
// ============================================
class SocialNetwork {
private:
  vector<User *> *users;       // This acts like your users database table
  vector<Message *> *messages; // This acts like your messages database table

public:
  SocialNetwork()
      : users(new vector<User *>()), messages(new vector<Message *>()) {}
  ~SocialNetwork() {
    for (auto user : *users)
      delete user;
    for (auto msg : *messages)
      delete msg;
    delete users;
    delete messages;
  }

  // CREATE - Add new user
  void addUser(User *newUser) { users->push_back(newUser); }

  // CREATE - Add new message
  void addMessage(Message *msg) { messages->push_back(msg); }

  // READ - Find user by username
  User *findUser(string userName) {
    for (size_t i = 0; i < users->size(); i++) {
      if (users->at(i)->getIdOfUser() == userName) {
        return users->at(i);
      }
    }
    return nullptr;
  }

  // READ - Find user by email (CASE-INSENSITIVE)
  // Converts both the stored email and the input to lowercase before comparing
  User *findUserByEmail(const string &email) {
    // Lambda to convert a string to lowercase
    auto toLower = [](string s) {
      transform(s.begin(), s.end(), s.begin(), ::tolower);
      return s;
    };
    string emailLower = toLower(email);
    for (size_t i = 0; i < users->size(); i++) {
      if (toLower(users->at(i)->getEmail()) == emailLower) {
        return users->at(i);
      }
    }
    return nullptr;
  }

  // READ - Get all users as JSON array
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

  // READ - Get messages between two users as JSON array
  // Returns messages where (from=user1 AND to=user2) OR (from=user2 AND
  // to=user1)
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

  size_t getUserCount() { return users->size(); }
};

// ============================================
// HELPER: Extract a value from a JSON string
// ============================================
// The frontend sends data as JSON strings like:
// {"email":"a@b.com","password":"123"} This function pulls out the value for a
// given key. Example: getJSONValue(R"({"email":"a@b.com"})", "email") →
// "a@b.com"
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

// ============================================
// MAIN
// ============================================
int main() {
  // ---- Step 1: Create the server ----
  // httplib::Server is a class from httplib.h that lets your C++ program
  // listen for HTTP requests (just like how a website's backend works)
  httplib::Server server;

  // ---- Step 2: Create your "database" and add test users ----
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
  // ---- Step 3: Set up CORS ----
  // CORS = Cross-Origin Resource Sharing
  // Problem: Your frontend runs on localhost:5173 and backend on
  // localhost:8080.
  //          Browsers block requests between different ports by default
  //          (security).
  // Solution: Tell the browser "I allow requests from other origins" by setting
  //           these headers on every response.
  server.Options(
      R"(/api/.*)", [](const httplib::Request &, httplib::Response &res) {
        res.set_header("Access-Control-Allow-Origin",
                       "*"); // Who can access, "*" means everyone
        res.set_header("Access-Control-Allow-Methods",
                       "GET, POST, OPTIONS"); // What methods are allowed
        res.set_header("Access-Control-Allow-Headers",
                       "Content-Type"); // What headers are allowed
        res.status = 200;
      });

  // ---- Step 4: POST /api/login ----
  // When the React frontend submits the login form, it sends a POST request
  // to this endpoint with JSON like: {"email":"...","password":"..."}
  // We check the credentials and send back the user data or an error.
  server.Post("/api/login",
              [ericGram](const httplib::Request &req, httplib::Response &res) {
                // Parse the email and password from the request body
                string email = getJSONValue(req.body, "email");
                string password = getJSONValue(req.body, "password");

                // Look up the user in our "database"
                User *user = ericGram->findUserByEmail(email);

                // Allow frontend to read the response
                res.set_header("Access-Control-Allow-Origin", "*");

                // Check if user exists AND password matches
                if (!user || !user->checkPassword(password)) {
                  res.status = 401; // 401 = Unauthorized
                  res.set_content("{\"error\":\"Invalid email or password\"}",
                                  "application/json");
                  return;
                }

                // Success! Send back the user's data as JSON
                res.set_content(user->toJSON(), "application/json");
              });

  // ---- Step 5: GET /api/users ----
  // When the React FeedPage loads, it sends a GET request here
  // to fetch all users and display them as cards in the grid.
  server.Get("/api/users",
             [ericGram](const httplib::Request &, httplib::Response &res) {
               res.set_header("Access-Control-Allow-Origin", "*");
               res.set_content(ericGram->getAllUsersJSON(), "application/json");
             });

  // ---- Step 5b: POST /api/friends/add ----
  // When the user clicks "Add Friend" on a UserCard or ProfileModal,
  // the frontend sends: {"userName":"ericphXm","friendUserName":"alice123"}
  // This adds a BIDIRECTIONAL friendship (both users become friends with each
  // other)
  server.Post("/api/friends/add", [ericGram](const httplib::Request &req,
                                             httplib::Response &res) {
    res.set_header("Access-Control-Allow-Origin", "*");

    // Parse who is adding who
    string userName = getJSONValue(req.body, "userName");
    string friendUserName = getJSONValue(req.body, "friendUserName");

    // Find both users in the database
    User *user = ericGram->findUser(userName);
    User *friendUser = ericGram->findUser(friendUserName);

    // Validate both users exist
    if (!user || !friendUser) {
      res.status = 404;
      res.set_content("{\"error\":\"User not found\"}", "application/json");
      return;
    }

    // Check if already friends
    if (user->isFriend(friendUserName)) {
      res.status = 400;
      res.set_content("{\"error\":\"Already friends\"}", "application/json");
      return;
    }

    // Add friendship in BOTH directions
    // (like Instagram mutual follows)
    user->addFriend(friendUser);
    friendUser->addFriend(user);

    // Return the updated user object so React can update the UI
    res.set_content(user->toJSON(), "application/json");
  });

  // ---- Step 5c: POST /api/messages/send ----
  // When the user sends a message from the chat modal,
  // the frontend sends: {"from":"ericphXm","to":"alice123","text":"Hey!"}
  server.Post("/api/messages/send", [ericGram](const httplib::Request &req,
                                               httplib::Response &res) {
    res.set_header("Access-Control-Allow-Origin", "*");

    string from = getJSONValue(req.body, "from");
    string to = getJSONValue(req.body, "to");
    string text = getJSONValue(req.body, "text");

    // Validate both users exist
    if (!ericGram->findUser(from) || !ericGram->findUser(to)) {
      res.status = 404;
      res.set_content("{\"error\":\"User not found\"}", "application/json");
      return;
    }

    // Create and store the message
    Message *msg = new Message();
    msg->fromUser = from;
    msg->toUser = to;
    msg->text = text;
    msg->timestamp = "just now";
    ericGram->addMessage(msg);

    res.set_content("{\"status\":\"sent\"}", "application/json");
  });

  // ---- Step 5d: GET /api/messages?user1=X&user2=Y ----
  // Fetches all messages between two users (the conversation)
  // Query parameters: ?user1=ericphXm&user2=alice123
  server.Get("/api/messages",
             [ericGram](const httplib::Request &req, httplib::Response &res) {
               res.set_header("Access-Control-Allow-Origin", "*");

               // req.get_param_value() reads the query string parameters
               // from URL: /api/messages?user1=ericphXm&user2=alice123
               string user1 = req.get_param_value("user1");
               string user2 = req.get_param_value("user2");

               res.set_content(ericGram->getConversationJSON(user1, user2),
                               "application/json");
             });

  // ---- Step 6: Start listening ----
  // This is a BLOCKING call — the program stays here, actively listening
  // for requests from the browser/React app. Your terminal will show
  // the message below and then wait until you press Ctrl+C to stop.
  cout << "Server starting on http://localhost:8080" << endl;
  server.listen("localhost", 8080);

  // Cleanup (only reached after server stops)
  delete ericGram;
  return 0;
}
