# Search View Component Example

**Live examples:**

- https://tides.org (Global Search in Main Nav)
- https://tides.org/impact-partners/explore-our-partners/

Allows to have multiple, independent results listings, each being populated
by it's own REST endpoint. In the first example URL, the search has 2 views, on
the left if displays the results from a general search (similar to the
default WP Search) & on the right it displays results only from the
`project` post type

This is an opinionated component, you provide it with the config and elements
it requires, and the rest is handled under the hood.

This Search View component is designed to be used together with the WP-REST API

## Features

- Search results templates via pure functions that return markup
  (compilation is handled internally)
- Multiple search results views at once
- Pagination
- Taxonomy queries
- Debounced search-as-you-type functionality
- Setting queryies via URL string on load
- Infinite scroll loading

This component & it's dependencies manage object creation via factory
function & object extension via composition (Object `mixins`).

## Simplified model of the component architecture:

```
instance               | provides configuration & markup for views
 |
 |-> searchViewFactory | manages the searchView state
     |
     |-> postEndpoint1 | handles triggering requests to the API and
     |-> postEndpoint2 | managing the query
         |
         |->apiFetch   | handle HTTP requests
```

## Usage

```

import searchViewFactory from './search'

function itemTemplate(post) {
  return <div>${ post.title.rendered }</div>
}

const searchViewEl = document.querySelector('#search-view')

const search = searchViewFactory(searchViewEl, {
  input: searchViewEl.querySelector('input'),
  taxToggles: searchViewEl.querySelectorAll('[data-taxonomy]'),
  listings: {
    posts: {
      template: itemTemplate,
      rootEl: searchViewEl.querySelector('[data-posts]'),
      pathname: '/wp-json/wp/v2/posts',
      scroll: true,
      config: {
        per_page: 12
      }
    }
  }
})

search.init()

```
