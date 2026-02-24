cmake_minimum_required(VERSION 3.20)
project(fusion_recorder LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(fusion_recorder fusion_recorder.cpp)
