cmake_minimum_required(VERSION 4.0)

find_package(cmake-bare REQUIRED PATHS node_modules/cmake-bare)
find_package(cmake-fetch REQUIRED PATHS node_modules/cmake-fetch)

project(bare_tls C CXX)

bare_target(target)

if(target MATCHES "win32")
  add_definitions(-DWIN32_LEAN_AND_MEAN)
endif()

if(target MATCHES "win32-x64")
  enable_language(ASM_NASM)
else()
  enable_language(ASM)
endif()

fetch_package("github:google/boringssl#0.20260211.0")

set(root_certificates_bundle "${CMAKE_CURRENT_BINARY_DIR}/root-certificates.pem")

file(DOWNLOAD
  "https://curl.se/ca/cacert-2026-03-19.pem"
  "${root_certificates_bundle}"
  TLS_VERSION 1.2
  TLS_VERIFY ON
)

file(READ "${root_certificates_bundle}" root_certificates_data HEX)

string(REGEX REPLACE "([0-9a-f][0-9a-f])" "0x\\1," root_certificates_array "${root_certificates_data}")

set(root_certificates "${CMAKE_CURRENT_BINARY_DIR}/root-certificates.c")

file(WRITE "${root_certificates}"
  "#include <stddef.h>\n\n"
  "const unsigned char bare_tls_root_certs[] = {\n${root_certificates_array}\n};\n\n"
  "const size_t bare_tls_root_certs_len = sizeof(bare_tls_root_certs);\n"
)

add_bare_module(bare_tls)

target_sources(
  ${bare_tls}
  PRIVATE
    binding.c
    "${root_certificates}"
)

target_link_libraries(
  ${bare_tls}
  PUBLIC
    ssl
)
