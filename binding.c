#include <assert.h>
#include <bare.h>
#include <js.h>
#include <js/ffi.h>
#include <tls.h>

typedef struct {
  tls_context_t *handle;
} bare_tls_context_t;

typedef struct {
  tls_t *handle;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_read;
  js_ref_t *on_write;
} bare_tls_t;

static js_value_t *
bare_tls_init_context (js_env_t *env, js_callback_info_t *info) {
  int err;

  js_value_t *handle;

  bare_tls_context_t *context;
  err = js_create_arraybuffer(env, sizeof(bare_tls_context_t), (void **) &context, &handle);
  assert(err == 0);

  err = tls_context_init(&context->handle);
  if (err < 0) {
    js_throw_error(env, NULL, "TLS error");
    return NULL;
  }

  js_value_t *result;
  err = js_create_typedarray(env, js_uint8_array, sizeof(*context), handle, 0, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tls_destroy_context (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tls_context_t *context;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &context, NULL, NULL, NULL);
  assert(err == 0);

  tls_context_destroy(context->handle);

  return NULL;
}

static int
bare_tls__on_read (tls_t *tls, char *buffer, int len, void *data) {
  int err;

  bare_tls_t *socket = (bare_tls_t *) data;

  js_env_t *env = socket->env;

  js_value_t *arraybuffer;
  err = js_create_external_arraybuffer(env, (void *) buffer, len, NULL, NULL, &arraybuffer);

  js_value_t *typedarray;
  err = js_create_typedarray(env, js_uint8_array, len, arraybuffer, 0, &typedarray);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, socket->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_read;
  err = js_get_reference_value(env, socket->on_read, &on_read);
  assert(err == 0);

  js_value_t *result;
  err = js_call_function(env, ctx, on_read, 1, &typedarray, &result);
  assert(err == 0);

  err = js_get_value_int32(env, result, &len);
  assert(err == 0);

  err = js_detach_arraybuffer(env, arraybuffer);
  assert(err == 0);

  return len == 0 ? tls_retry : len;
}

static int
bare_tls__on_write (tls_t *tls, const char *buffer, int len, void *data) {
  int err;

  bare_tls_t *socket = (bare_tls_t *) data;

  js_env_t *env = socket->env;

  js_value_t *arraybuffer;
  err = js_create_external_arraybuffer(env, (void *) buffer, len, NULL, NULL, &arraybuffer);
  assert(err == 0);

  js_value_t *typedarray;
  err = js_create_typedarray(env, js_uint8_array, len, arraybuffer, 0, &typedarray);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, socket->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_write;
  err = js_get_reference_value(env, socket->on_write, &on_write);
  assert(err == 0);

  js_value_t *result;
  err = js_call_function(env, ctx, on_write, 1, &typedarray, &result);
  assert(err == 0);

  err = js_get_value_int32(env, result, &len);
  assert(err == 0);

  err = js_detach_arraybuffer(env, arraybuffer);
  assert(err == 0);

  return len == 0 ? tls_retry : len;
}

static js_value_t *
bare_tls_init (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 7;
  js_value_t *argv[7];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 7);

  bare_tls_context_t *context;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &context, NULL, NULL, NULL);
  assert(err == 0);

  js_value_t *handle;

  bare_tls_t *socket;
  err = js_create_arraybuffer(env, sizeof(bare_tls_t), (void **) &socket, &handle);
  assert(err == 0);

  err = tls_init(context->handle, bare_tls__on_read, bare_tls__on_write, (void *) socket, &socket->handle);
  if (err < 0) {
    js_throw_error(env, NULL, "TLS error");
    return NULL;
  }

  bool is_server;
  err = js_get_value_bool(env, argv[1], &is_server);
  assert(err == 0);

  if (is_server) err = tls_accept(socket->handle);
  else err = tls_connect(socket->handle);
  assert(err == 0);

  bool has_cert;
  err = js_is_typedarray(env, argv[2], &has_cert);
  assert(err == 0);

  if (has_cert) {
    char *pem;
    size_t len;
    err = js_get_typedarray_info(env, argv[2], NULL, (void **) &pem, &len, NULL, NULL);
    assert(err == 0);

    err = tls_use_certificate(socket->handle, pem, (int) len);
    if (err < 0) {
      tls_destroy(socket->handle);
      js_throw_error(env, NULL, "TLS error");
      return NULL;
    }
  }

  bool has_key;
  err = js_is_typedarray(env, argv[3], &has_key);
  assert(err == 0);

  if (has_key) {
    char *pem;
    size_t len;
    err = js_get_typedarray_info(env, argv[3], NULL, (void **) &pem, &len, NULL, NULL);
    assert(err == 0);

    err = tls_use_key(socket->handle, pem, (int) len);
    if (err < 0) {
      tls_destroy(socket->handle);
      js_throw_error(env, NULL, "TLS error");
      return NULL;
    }
  }

  js_value_t *result;
  err = js_create_typedarray(env, js_uint8_array, sizeof(*socket), handle, 0, &result);
  assert(err == 0);

  socket->env = env;

  err = js_create_reference(env, argv[4], 1, &socket->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[5], 1, &socket->on_read);
  assert(err == 0);

  err = js_create_reference(env, argv[6], 1, &socket->on_write);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tls_destroy (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tls_t *socket;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &socket, NULL, NULL, NULL);
  assert(err == 0);

  tls_destroy(socket->handle);

  err = js_delete_reference(env, socket->on_read);
  assert(err == 0);

  err = js_delete_reference(env, socket->on_write);
  assert(err == 0);

  err = js_delete_reference(env, socket->ctx);
  assert(err == 0);

  return NULL;
}

static js_value_t *
bare_tls_handshake (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tls_t *socket;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &socket, NULL, NULL, NULL);
  assert(err == 0);

  err = tls_handshake(socket->handle);
  if (err < 0 && err != tls_retry) {
    js_throw_error(env, NULL, "TLS error");
    return NULL;
  }

  js_value_t *result;
  err = js_get_boolean(env, err != tls_retry, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tls_read (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_tls_t *socket;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &socket, NULL, NULL, NULL);
  assert(err == 0);

  char *buffer;
  size_t len;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &buffer, &len, NULL, NULL);
  assert(err == 0);

  err = tls_read(socket->handle, buffer, (int) len);
  if (err < 0 && err != tls_eof) {
    js_throw_error(env, NULL, "TLS error");
    return NULL;
  }

  js_value_t *result;
  err = js_create_uint32(env, (int) err == tls_eof ? 0 : err, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tls_write (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_tls_t *socket;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &socket, NULL, NULL, NULL);
  assert(err == 0);

  char *buffer;
  size_t len;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &buffer, &len, NULL, NULL);
  assert(err == 0);

  err = tls_write(socket->handle, buffer, (int) len);
  if (err < 0) {
    js_throw_error(env, NULL, "TLS error");
    return NULL;
  }

  js_value_t *result;
  err = js_create_uint32(env, err, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tls_shutdown (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_tls_t *socket;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &socket, NULL, NULL, NULL);
  assert(err == 0);

  err = tls_shutdown(socket->handle);
  if (err < 0 && err != tls_retry) {
    js_throw_error(env, NULL, "TLS error");
    return NULL;
  }

  js_value_t *result;
  err = js_get_boolean(env, err != tls_retry, &result);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_tls_exports (js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("initContext", bare_tls_init_context);
  V("destroyContext", bare_tls_destroy_context);

  V("init", bare_tls_init);
  V("destroy", bare_tls_destroy);
  V("handshake", bare_tls_handshake);
  V("read", bare_tls_read);
  V("write", bare_tls_write);
  V("shutdown", bare_tls_shutdown);
#undef V

  return exports;
}

BARE_MODULE(bare_tls, bare_tls_exports)
