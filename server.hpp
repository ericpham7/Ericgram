#ifndef SERVER_HPP
#define SERVER_HPP

#include "include/httplib.h"
#include <iostream>
#include <string>

// Forward declarations
class SocialNetwork;

// Declared here, implemented in main.cpp
void addTestUsers(SocialNetwork *&ericGram);
void setupServer(httplib::Server &server, SocialNetwork *network);

// Helper: extract a value from a simple JSON string by key
// e.g. getJSONValue("{\"email\":\"a@b.com\"}", "email") -> "a@b.com"
inline std::string getJSONValue(const std::string &json,
                                const std::string &key) {
  std::string searchKey = "\"" + key + "\":\"";
  size_t start = json.find(searchKey);
  if (start == std::string::npos)
    return "";
  start += searchKey.length();
  size_t end = json.find("\"", start);
  if (end == std::string::npos)
    return "";
  return json.substr(start, end - start);
}

// Start the server on the given host and port
inline void startServer(httplib::Server &server, const std::string &host,
                        int port) {
  std::cout << "Server starting on http://" << host << ":" << port << std::endl;
  server.listen(host, port);
}

#endif // SERVER_HPP
