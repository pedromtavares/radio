
0.2.1 / 2011-03-25 
==================

  * Added __LICENSE__ file
  * Fixed; do not assume content-type is present [reported by c4milo]

0.2.0 / 2010-12-15 
==================

  * Fixed issue with complete callback not being registered. Closes #5

0.1.2 / 2010-07-28
==================

  * Removed require("connect/utils")

0.1.1 / 2010-07-27
==================

  * Added support for bodyDecoder / connect-form to coexist
  * Added lib/connect-form.js

0.1.0 / 2010-07-14
==================

  * Changed api:
    - use `form.complete(function(){})` instead of `form.onComplete = function(){}`
