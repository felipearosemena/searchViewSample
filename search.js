/**
 *
 * Search View
 *
 * Handles querying the WP Rest API for search results &
 * populating them into a user defined container.
 *
 * For each `listing` key defined on the component initialization, a
 * corresponding `postEndpoint` will be created, which will handle querying the
 * REST API for results.
 *
 */

import { stateMixin, templateMixin } from './mixins'
import postEndpointFactory from './postEndpoint'
import { debounce, mapObject, collection, toggleClass, inArray, elScrolledToBottom } from './utils'


/**
 * Search View Defaults
 * @type {Object}
 */
const defaults = {
  /**
   * Timeout for the search input, used for debouncing search requests
   * @type {Number}
   */
  searchTimeout: 600
}

/**
 * Listing Defaults
 * @type {Object}
 */
const listingDefaults = {

  /**
   * The default key used by WP Rest to perform a 'search' query
   * @type {String}
   */
  searchParam: 'search',

  /**
   * No Results template should be a function that returns a single root element's markup.
   * Null by default (noop)
   * @type {Function|Null}
   */
  noResultsTemplate: null,

  /**
   * Tells the listing to set the query based on the URL query string on load
   * @type {Boolean}
   */
  parseURL: false
}

/**
 *
 * Selectors for unique elements inside the view.
 *
 * @type {Array}
 */
const uiSelectors = [
  'scrollWrapper',
]

/**
 * Selectors for elements within the view that can have
 * more than 1 occurrence.
 *
 * @type {Array}
 */
const uiArraySelectors = [
  'count',
  'query',
  'loadMore'
]


/**
 * Search view prototype
 * @type {Object}
 */
const searchViewProto = {

  /**
   * Scroll the view to the top
   * @return {null}
   */
  scrollToTop() {

    const { scrollWrapper } = this.els

    if(!scrollWrapper) {
      return
    }

    scrollWrapper.scrollTop = 0

  },

  /**
   * Create a listing instance within the view.
   * The listing will contain an `endpoint` object which is a `postEndpointFactory()` instance
   * which will handle querying the REST API for posts.
   *
   * If the `listingConfig` validates, then a listing instance gets assigned to this.listings with the
   * `name` parameter as a key.
   *
   * @param  {String} name Unique name to be used for this listing
   * @param  {Object}      listingConfig Configuration object for the listing
   * @param  {Function}    listingConfig.template Template function for the listing to use
   * @param  {HTMLElement} listingConfig.rootEl Root element where the listing will add new elements to
   * @param  {String}      listingConfig.pathname Base pathname that the listing will use to query the API with
   * @param  {String}      listingConfig.searchParam Query parameter key required for the listing to perform a search in the give API.
   * For default WP Rest endpoints, the key is 'search'. Example: 'wp/v2/posts?search=search-query'
   * @param  {Boolean}     listingConfig.scroll Whether scrolling the `scrollWrapper` element in the listing should trigger loading the
   * next set of items within
   * @param  {Object}      listingConfig.config Additional query parameters that should be set as defaults for the API endpoint
   *
   * @return {null}
   */
  createListing(name = '', listingConfig = {}) {

    const listingOptions = Object.assign({}, listingDefaults, listingConfig)

    const { rootEl, pathname, template, searchParam, config, parseURL } = listingOptions

    const warning = message => {
      console.warn(`${name} listing error: ${message}`)
    }

    if (!rootEl) {
      warning(`the listing object is missing an 'rootEl' HTML Element`)
      return
    }

    if(!template || typeof template !== 'function') {
      warning(`You are either missing a 'template' property or the template passed is not a function`)
      return
    }

    if(!pathname.length) {
      warning(`The 'pathname' passed to this listing is empty, you must add a URL that this listing will query`)
      return
    }

    if(!searchParam.length) {
      warning(`You must specify a 'searchParam' property, which will get used as the search query parameter for the endpoint`)
      return
    }

    this.listings[name] = Object.assign({}, listingOptions, {
      endpoint: postEndpointFactory(pathname, config, parseURL)
    })

  },

  /**
   * Populate the listing from an array of posts. Contains the logic
   * for staggering the revealing of the items.
   *
   * @param  {Object} listing Listing object from the searchView instance
   * @param  {Array} posts   Array of posts to populate with
   * @return {null}
   */
  populate(listing, posts) {

    const { endpoint, rootEl, template, noResultsTemplate } = listing

    this.clearListing(listing)

    const elements = posts.length ?
      // Compile the posts into HTML elements
      posts.map(post => this.compile(post, template)) :
      // If theres a template for "No Results", use it
      noResultsTemplate ? [ this.compile({}, noResultsTemplate) ] : []

    elements
      // Add them
      .map(el => {
        const toggle = toggleClass(el, 'is-hidden', true)
        rootEl.appendChild(el)
        return toggle
      })
      // Reveal in a staggered manner
      .map((toggle, i) => setTimeout(() => toggle(false) , i * 50 + 100))

    this.publish('populated', elements, listing)

  },

  clearListing({ endpoint, rootEl }) {
    // Clear and scroll to the top if we're on the first page
    if(endpoint.getPage() == 1) {
      rootEl.innerHTML = ''
      this.scrollToTop()
    }
  },

  /**
   * Sums up the total posts between the multiple listings this instance has
   * @return {Number} Total number of posts between listings
   */
  getTotalFoundPosts() {

    let found = 0

    mapObject(this.listings, (name, { endpoint }) => {
      if(Number.isInteger(endpoint.state.foundPosts)) {
        found += endpoint.state.foundPosts
      }
    })

    return found
  },

  /**
   *
   * Perform a search query in each of the listings in this instance.
   *
   * Once each listing has results, calls populate to update the UI.
   *
   * Once all listings promises are done, update the state of the view with the new found posts.
   *
   * @return {Promise} Promise.all instance of the queries made. If the input is empty
   * Promise.all gets called with an empty array for immediate resolution.
   *
   */
  search() {

    const { input } = this.options

    const promises = []

    mapObject(this.listings, (name, listing) => {
      const query = {}
      query[listing.searchParam] = input.value
      promises.push(this.setListingQuery(listing, query))
    })

    return Promise.all(promises)
      .then(() => {
        this.setResultsVariables()
      })

  },

  /**
   * Update the query for a given listing & populate the listing with it's results.
   * Toggles loading state & updates foundPosts when request is complete.
   *
   * @param {Object/undefined} listing Listing object from this view to update
   * @param {Object} query The query to update the listing's enpoint with
   *
   *  @return {Promise} api request promise
   */
  setListingQuery(listing, query = {}) {

    const { endpoint } = listing

    this.setState({ loading: true })

    return endpoint.setQuery(query)
      .then(posts => {

        this.populate(listing, posts)
        this.setResultsVariables()
      })
  },

  /**
   * Tally the number of total posts found & clear loading state
   *
   * @return {Null}
   */
  setResultsVariables() {
    this.setState({
      loading: false,
      foundPosts: this.getTotalFoundPosts()
    })
  },

  /**
   *
   * Check it the view's scroll wrapper has scrolled all the way, if so run a callback
   *
   * @param  {Function} cb Callback function to run if it has
   * @return {null}
   */
  checkBottom (cb = () => {})  {

    const { scrollWrapper } = this.els

    // If the view is hidden, we don't want to run the callback
    if(!this.state.visible) {
      return
    }

    if(elScrolledToBottom(scrollWrapper)) {
      cb()
    }
  },

  /**
   * Bind listeners for search input
   * @return {null}
   */
  bindInput() {

    const { searchTimeout, input } = this.options

    if(!input) {
      console.warn('you have not provided an input element for the search')
      return false
    }

    // We want to update the loading & visible states as soon as the user types
    input.addEventListener('input', () => {
      this.setState({
        loading: !!input.value.length,
        visible: !!input.value.length
      })
    })

    // But we debounce performing the actual search so
    // that we don't perform unnecessary XHR requests (give the user a littl
    // time to type)
    input.addEventListener('input', debounce(() => {
      this.search()
    }, searchTimeout))

  },

  /**
   * Listen for state changes in the view and perform general UI updates
   * @return {null}
   */
  bindState() {

    const { input } = this.options

    this.subscribe('state-set', ({ loading, visible, foundPosts }) => {

      const toggle = toggleClass(this.el)
      toggle('is-loading', loading)
      toggle('is-empty', !visible)

      // Update the count and query UI elements
      const { count, query } = this.elsArrays

      // Populate the message only when the View is not loading anymore
      if(!loading) {
        count.map(el => {

          const { listing } = el.dataset

          if(this.listings[listing]) {
            const { endpoint } = this.listings[listing]
            const { foundPosts } = endpoint.state
            el.innerHTML = foundPosts
          } else {
            el.innerHTML = foundPosts
          }

        })

        query.map(el => el.innerHTML = input.value)
      }

    })

  },

  /**
   * Handles loading more posts when the user scrolls down the bottom of the view
   * @return {null}
   */
  bindScroll() {

    const { scrollWrapper } = this.els
    let hasScroll = false

    // Load the new set of posts
    const get = debounce(() => {

      mapObject(this.listings)
        .filter(({ scroll }) => scroll)
        .map(listing => {
          const { endpoint } = listing

          if(endpoint.state.isFinished) {
            return
          }

          this.setState({ loading: true })

          endpoint.get()
            .then(p => {
              this.setState({ loading: false })
              this.populate(listing, p)
            })

        })

    }, 300, true)

    // Scroll handler helper
    const onScroll = (name) => {
      this.checkBottom(get)
    }

    mapObject(this.listings, (name, { scroll, endpoint }) => {

      if(!scroll) {
        return
      } else {
        hasScroll = true
      }

      if(scroll & !scrollWrapper) {
        console.warn(`You are missing a scrollWrapper element to detect scroll loading for ${ name } listing. Make sure to add a [data-scrollWrapper] element inside the view root.`)
        return
      }

      this.subscribe('scroll', () => onScroll(name))

    })

    if(hasScroll) {
      // Mousewheel & touchmove events
      ['wheel', 'touchmove'].map(e => {
        scrollWrapper.addEventListener(e, () => this.publish('scroll'))
      })

      // Pressing down on the keyboard
      window.addEventListener('keydown', e => {
        if(e.keyCode == 40) {
          this.publish('scroll')
        }
      })
    }

  },

  /**
   *
   * Bind load more button clicks to load and populate with the next set of posts
   *
   * @return {null}
   */
  bindLoadMore() {

    const { loadMore } = this.elsArrays

    loadMore.map(btn => {

      const listing = this.listings[btn.dataset.listing]

      if(!listing) {
        console.warn(`There is no matching listing for this loadMore button. Make sure the button has a [data-listing] property and it's value
          is one of [${ Object.keys(this.listings) }]`)
        return
      }

      const { endpoint } = listing
      const toggle = toggleClass(btn, 'is-hidden')

      // Toggle the button visibility if the endpoint has finished or not
      endpoint.subscribe('state-set', ({ isFinished }) => toggle(isFinished))

      btn.addEventListener('click', e => {

        this.setState({ loading: true })

        endpoint.get()
          .then(p => {
            this.setState({ loading: false })
            this.populate(listing, p)
          })

      })
    })
  },

  /**
   * Bind click on the tax toggles and populate the corresponding listing
   * with the results.
   *
   * @return {null}
   */
  bindTaxToggles() {

    const taxToggles = collection(this.options.taxToggles)

    if(!taxToggles.length) {
      console.warn('you have not provided an type toggle elements')
      return false
    }

    /**
     * Handle the `tax-set` event, updates active classes and
     * updates the corresponding listing elements
     *
     * If `shouldToggle` is set to true, then passing the same query value
     * will add/remove the query value from the exising list of values
     *
     * If set to false, then the passed `slug` will replace the `currentQuery` value
     *
     */
    this.subscribe('tax-set', (tax, slug, listingName, shouldToggle) => {

      const query = {}
      const listing = this.listings[listingName]

      // Get the current values for this tax query
      // and convert it to an array
      const currentQuery = (listing.endpoint.getParam(tax) || '')
        .split(',')
        // Filter empty
        .filter(v => v)

      let nextQuery = []

      // If we're togglig, we want to toggle this slug on/off, but keep all other
      // active ones
      if(shouldToggle) {

        nextQuery = inArray(slug, currentQuery) ?
          currentQuery.filter(s => s !== slug) :
          currentQuery.concat([slug])

      } else {
        // Otherwise just push this one slug to the next query and that's it
        nextQuery.push(slug)
      }

      // Join the term or terms into a single comma separated list of values
      // for this tax query
      query[tax] = nextQuery.join(',')

      // If the end result is the same query as we had before, do nothing
      if(currentQuery.join() == nextQuery.join()) {
        return
      }

      // Update the listing elements
      this.setListingQuery(listing, query)

    })

    // Attach click listeners to all taxonomy toggles
    taxToggles.map(el => {
      el.addEventListener('change', e => {

        if(el.classList.contains('is-active')) {
          return
        }

        const { taxonomy, listing } = el.dataset
        const slug = el.value
        const shouldToggle = e.target.type == 'checkbox'

        if(!this.listings[listing]) {
          console.warn(`There is no listing matching this toggle.
            Check that the [data-listing] attribute value is one of ["${ Object.keys(this.listings).join('","') }"].`)
          return
        }

        this.publish('tax-set', taxonomy, slug, listing, shouldToggle)

      })
    })

  },

  init() {
    this.bindInput()
    this.bindTaxToggles()
    this.bindState()
    this.bindScroll()
    this.bindLoadMore()
  }

}

/**
 *
 * Creates a search view instance
 *
 * @param  {HTMLElement} el Root element containing all the elements required for the UI of the search
 *
 * @implements {stateMixin}
 * @implements {templateMixin}
 *
 * @param  {Object} config Configuration object
 * @return {Object}    Search View instance
 */
export default function searchViewFactory(el, config = {}) {

  const instance   = Object.assign(Object.create(searchViewProto), stateMixin({
    loading: false,
    visible: false,
    foundPosts: 0
  }), templateMixin())

  instance.listings = {}
  instance.el  = el
  instance.els = {}
  instance.elsArrays = {}

  // Grab unique UI elements
  uiSelectors.map(selector => {
    instance.els[selector] = el.querySelector(`[data-${selector}]`)
  })

  // Grab collection UI elements
  uiArraySelectors.map(selector => {
    instance.elsArrays[selector] = collection(el.querySelectorAll(`[data-${selector}]`))
  })

  // Assign options
  instance.options = Object.assign({}, defaults, config)

  if(!Object.keys(instance.options.listings).length) {
    console.warn('You have not specified any listings to use in the search module')
  }

  // create the listing instances
  mapObject(instance.options.listings, (name, config) => instance.createListing(name, config))

  return instance
}
