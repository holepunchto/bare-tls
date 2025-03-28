cmake_minimum_required(VERSION 3.31)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_MACOSX_BUNDLE OFF)

project(bare_tls C CXX ASM)

bare_target(target)

if(target MATCHES "win32")
  add_definitions(-DWIN32_LEAN_AND_MEAN)
endif()

fetch_package("github:google/boringssl#0.20250311.0")

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
