cmake_minimum_required(VERSION 3.25)

project(bare_tls C CXX)

include(bare)

if(NOT TARGET tls)
  add_subdirectory(vendor/libtls EXCLUDE_FROM_ALL)
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
    tls_static
)
