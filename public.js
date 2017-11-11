/**
 * Search View Component Usage Example
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

search.init()
