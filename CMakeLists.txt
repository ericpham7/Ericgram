cmake_minimum_required(VERSION 3.20)

project(MyProject LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS ON)

find_package(OpenSSL REQUIRED)

add_executable(my_app main.cpp)

target_include_directories(my_app PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/include")

target_link_libraries(my_app PRIVATE OpenSSL::SSL OpenSSL::Crypto)
