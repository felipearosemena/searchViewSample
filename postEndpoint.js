/**
 *
 * Post Endpoint
 *
 * Creates an enpoint object, which keeps track of multiple queries to a given
 * API endpoint.
 *
 * IMPORTANT: Standard WP Rest enpoints ('posts', 'pages', etc) return an
 * `X-WP-TOTAL` header, which is the total number of posts in all pages for a
 * given WP_Query. If the  `pathname` passed points to a custom endpoint
 * returning posts, make sure that the WP_Rest_Response returned contains
 * this header.
 *
 * Designed to work with WP Rest api endpoints that return posts or custom post
 * types.
 *
 * Keeps track or pagination, query parameters as well as whether there more
 * posts to load.
 *
 * Usage:
 *
 * ```
 * const endpoint = postEndpointFactory('wp/v2/posts', { per_page: 6 })
 *
 * endpoint
 *   .get(posts => {
 *     // First page of query
 *   })
 *
 * endpoint
 *   .get(posts => {
 *     // Second page of query
 *   })
 *
 * endpoint
 *   .setQuery({ category_name: 'bar' })
 *   .then(posts => {
 *     // First page of new query
 *   })
 *
 * ```
 *
 */

import { stateMixin, requestMixin } from './mixins'
import { serializeObject, mapObject, extractURLParameters } from './utils'

/**
 * Returns a post endpoint object instance. Implements request mixin for caching of requests
 * & stateMixin for internal state management.
 *
 * @implements {stateMixin}
 * @implements {requestMixin}
 *
 * @param  {String} pathname The base pathname this endpoint is going to use
 * @param  {Object} config   Configuration object to be set as query paramters
 * @return {Object} post endpoint instance
 */
export default function postEndpointFactory(pathname, config = {}, parseURL = false, method = 'GET') {

  let page = 0
  let params = Object.assign({}, config)

  const endpoint = Object.assign(stateMixin(), requestMixin(), {

    state: {
      isFinished: false,
      foundPosts: 0
    },

    /**
     * Get all parameters
     * @return {Object} Object containing current query parameters
     */
    getParams() {
      return Object.assign({}, params)
    },

    /**
     * Get the current value of a given parameter key
     * @param  {String} key Key to look for in parameters
     * @return {Any} Parameter value or undefined
     */
    getParam(key = '') {
      return Object.assign({}, params)[key]
    },

    /**
     * Get the current page number of the endpoint
     * @return {Number} Page number
     */
    getPage(){
      return page
    },

    /**
     * Load the next page with the current query. Checks it the current query
     * is finished and sets finished state accordingly
     *
     * @return {Promise} Response.json() promise
     *
     */
    get() {

      const request = pathname + '?' + serializeObject(Object.assign({}, params, {
        page: ++page
      }))

      if(this.state.isFinished) {
        return
      }

      return this.fetch(request, method)
        .then(res => {

          const total = res.headers.get('X-WP-TOTAL')

          if(!total) {
            console.warn(`postEndpoint is meant to work with a WP Rest API response, which should contain an 'X-WP-TOTAL' headeer, stating the total number of posts in the query. The endpoint uses this to detect when there are no more posts to load.`)
            return res.json()
          }

          const isFinished = page * this.getParam('per_page') >= parseInt(total)

          this.setState({
            foundPosts: parseInt(res.headers.get('X-WP-TOTAL')),
            isFinished: isFinished
          })

          if(isFinished) {
            this.publish('listing-finished')
          }

          return res.json()
        })

    },

    /**
     * Set the query for the endpoint and call `this.get` to get the first
     * page of this new query automatically.
     *
     * If passing a query with an empty value, that key will get deleted from the request
     *
     * @param {Object} query Query paramters object
     * @return {Promise} The promise return value of `this.get()``
     */
    setQuery(query, runQuery = true) {
      page = 0
      this.setState({ isFinished: false })
      Object.assign(params, query)

      // Delete queries keys that are empty
      mapObject(params, (k, v) => {
        if(typeof v == 'string' && !v.length) {
          delete params[k]
        }
      })

      return runQuery ? this.get() : new Promise(r => r())
    },

    clearQuery() {
      params = Object.assign({}, config)
    }

  })

  // Set the initial query based on the parameters set
  if(parseURL) {
    endpoint.setQuery(extractURLParameters())
  }

  return endpoint

}
