/**
 * Search View Component Example
 *
 * Live examples:
 * http://tides.org (Global Search in Main Nav)
 * https://www.tides.org/impact-partners/explore-our-partners/
 *
 * Allows to have multiple, independent results listings, each being
 * by it's own REST endpoint. In the example URL, the search has 2 views, on
 * the left if displays the results from a general search (similar to the
 * default WP Search) & on the right it displays results only from the
 * `project` post type
 *
 * This Search View component is designed to be used together with the WP-REST API
 *
 * Features
 * - Search results templates via pure functions that return markup
 *   (compilation is handled internally)
 * - Multiple search results views at once
 * - Pagination
 * - Taxonomy queries
 * - Debounced search-as-you-type functionality
 * - Setting queryies via URL string on load
 * - Infinite scroll loading
 *
 * This component & it's dependencies manage object creation via factory
 * function & object extension via composition (Object mixins).
 *
 * A simplified model of the component architecture:
 *
 * instance               | provides configuration & markup for views
 *  |
 *  |-> searchViewFactory | manages the searchView state
 *      |
 *      |-> postEndpoint1 | handles triggering requests to the API and
 *      |-> postEndpoint2 | managing the query
 *          |
 *          |->apiFetch   | handle HTTP requests
 *
 */

import searchViewFactory from './search'
import { truncateWords } from './utils'

const searchViewEl = document.querySelector('#search-view')

/**
 *
 * Post item template
 * @param  {Object} post WP Rest post response object
 * @return {String} Element markup
 *
 */
function postSearchTemplate(post) {

  let link = post.link
  let target = '_self'

  const hasExcerpt = post.excerpt && post.excerpt.rendered

  return `
    <li class="listing-item">
      <a class="search-post" href="${ post.link }" target="_self">
        <span class="search-post__label">${ post.type }</span>
        <span class="search-post__content">
          <h4 class="search-post__title">${ post.title.rendered }</h4>
          ${ hasExcerpt && `<p>${ truncateWords(post.excerpt.rendered, 210) }</p>` }
        </span>
      </a>
    </li>
  `
}

/**
 * WP REST endpoint we want to query (Can use built in endpoints as well)
 * @type {String}
 */
const SEARCH_PATHNAME = window.Global.api_namespace + '/search'

// Config the listings to be shown
const listings = {
  posts: {
    template: postSearchTemplate,
    rootEl: searchViewEl.querySelector('[data-posts]'),
    pathname: SEARCH_PATHNAME,
    searchParam: 's',
    scroll: true,
    config: {
      per_page: 12
    }
  }
}

// Instantiate the searchView
// The search view will handle populating & managing the state of the
// search internally, based on the configuration properties passed.
const search = searchViewFactory(searchViewEl, {
  input: searchViewEl.querySelector('input'),
  taxToggles: searchViewEl.querySelectorAll('[data-taxonomy]'),
  listings: listings
})

// Refresh reveal style in cards inside search results
search.init()
