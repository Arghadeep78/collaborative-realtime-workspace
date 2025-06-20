// Standard success envelope for API responses. Mirrors APIError on the failure
// side so every endpoint emits a predictable, self-describing body:
//   { statusCode, message, success, data }
// `success` is derived from the status code so callers never have to set it.
export class APIResponse {
  constructor(statusCode, message, data = null) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.success = statusCode < 400;
  }
}
