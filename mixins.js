/**
 *
 * Factory functions that encapsulate common functionality
 * Used for composing with module instances via Object.assign
 *
 * IMPORTANT: Make sure to pass the mixins first to Object.assign, then your component's
 * own properties. This will ensure that your object overwrites any defaults set in the
 * mixin.
 *
 * Example:
 *
 * const mixin = function() {
 *   return {
 *     bar() {
 *       return 'bar'
 *     }
 *   }
 * }
 *
 * const myComponent = Object.assign({
 *   foo() {
 *     return 'foo'
 *   }
 * }, props)
 *
 * component.bar() // 'bar'
 * component.foo() // 'foo'
 *
 */

import equal from 'deep-equal'
import { createElement } from './utils'
import apiFetch from './apiFetch'
import { eventBusFactory } from './EventBus'


/**
 *
 * Provides caching functionality for apiFetch requests so that for
 * each given request string, only 1 network request is performed.
 * Subsequent requests to that endpoint will resolve immediately.
 *
 * @return {Object} requestMixin object
 *
 */
export function requestMixin() {

  /**
   * Requests cache
   * @type {Object}
   */
  const requests = {}

  return {

    /**
     *
     * Get a fetch promise for a given request. If the request hasnt been fetched,
     * perform an apiFetch call and cache it.
     *
     * @param  {String} request URL string of the request to be performe
     * @return {Promise} Cloned fetch promise, to allow to read it's results multiple times
     *
     */
    fetch(request = '', method) {

      if(!requests[request]) {
        requests[request] = apiFetch(request, method)
      }

      return requests[request].then(res => res.clone())

    }
  }
}

/**
 *
 * Provides an object with the ability to keep track of it's own internal
 * state, encapsulated within the "state" namespace of the object
 *
 * Each time the `setState()` is called , `state-set` will be called
 * with the new state but only if the state of the object has changed
 *
 * This mixin implement the `eventBusFatory` functionality
 *
 * Usage:
 *
 * const myComponent = Object.assign({
 *   foo() {}
 * }, stateMixin())
 *
 * myComponent.subscribe('state-set', state => {
 *   // Will run after calling `setState`
 * })
 *
 * myComponent.setState({ prop: 'value' })
 *
 * @return {Object} state mixin object
 *
 */
export function stateMixin(initialState = {}) {

  return Object.assign({}, {
    /**
     * Default state, empty object
     * @type {Object}
     */
    state: initialState,

    /**
     * Set the state of the object. If the state of the object has changed,
     * then the `state-set` event will be published on the object
     * @param {Object} data New data to update the state with
     *
     */
    setState(data = {}) {

      const prevState = Object.assign({}, this.state)
      const newState = Object.assign({}, this.state, data)

      // Check for equality
      if(!equal(newState, this.state)) {
        this.state = newState
        this.publish('state-set', this.state, prevState)
      }

    }
  }, eventBusFactory())

}

/**
 *
 * Provides an object with templating functionality
 *
 * @return {Object} template mixin object
 *
 */
export function templateMixin() {


  return {

    /**
     *
     * Compile an object and a template into an HTML Element
     *
     * @param  {Object} data Data to compile with the template
     * @param  {Function} template Template function, should return HTML markup with a single root element
     *
     * @return {HTMLElement} Compiled HTML Element
     *
     */
    compile(data = {}, template = () => `<div></div>`) {

      /**
      * Buffer element used by the compile function to insert & grab new elements
      * @type {HTMLElement}
      */
      const buffer = createElement('div')

      const markup = template(data)
      buffer.innerHTML = markup.length ? markup : ''
      return buffer.children[0]
    }
  }

}
