cmake_minimum_required(VERSION 3.25)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)

set(CMAKE_MACOSX_BUNDLE OFF)

project(bare_tls C CXX)

if(NOT TARGET ssl)
  add_subdirectory(vendor/boringssl EXCLUDE_FROM_ALL)
endif()

add_bare_module(bare_tls)

target_sources(
  ${bare_tls}
  PRIVATE
    binding.c
)

target_link_libraries(
  ${bare_tls}
  PUBLIC
    ssl
)
