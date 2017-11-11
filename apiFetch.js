/**
 *
 * Load
 *
 * Requires the fetch API to be available
 *
 */


/**
 *
 * Perform a fetch request to the WP Rest API. Set's the correct headers
 * in order to validate the request.
 *
 *
 * @param  {String} endpoint The url to be requested
 * @param  {String} method   Request method to use ('get' or 'post')
 * @param  {Object} body     Request body, to be used in 'post' request when sending FormData
 * @return {Promise}         Promise containing the request response
 *
 */

export default function apiFetch(endpoint, method = 'get', body = {}) {

  const headers = {
    'X-WP-Nonce': Global.nonce
  }

  if(!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const key = endpoint + method + JSON.stringify(body)

  return fetch(Global.api + endpoint, {
    credentials: 'same-origin',
    method: method,
    body: body instanceof FormData ?
      body :
      (method == 'post') ?
        JSON.stringify(body) :
        undefined,
    headers: new Headers(headers)
  })
  .then(handleError)

}
