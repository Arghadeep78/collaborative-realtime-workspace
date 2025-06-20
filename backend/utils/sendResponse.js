import { APIResponse } from './APIResponse.js';

// Thin, greppable helper for emitting the standard success envelope. A class
// instance and a plain object serialize identically, so this costs nothing on
// the wire while keeping adoption mechanical:
//   return sendResponse(res, 200, 'Project deleted');
//   return sendResponse(res, 200, 'Workspace renamed', wsView(ws, req.email));
export const sendResponse = (res, statusCode, message, data = null) =>
  res.status(statusCode).json(new APIResponse(statusCode, message, data));
