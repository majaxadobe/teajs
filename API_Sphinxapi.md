# Sphinx API module #

Defined in file `sphinxapi.js`.

Methods from the Sphinx Javascript API for TeaJS. See official Sphinx documentation at http://sphinx-doc.org

  * `var sphinx = SphinxClient()` - the constructor method for the SphinxClient class. Its sole purpose is to instantiate the class and set default variables. There are no arguments.
  * `sphinx.GetLastError()` - Returns last error thrown by the Sphinx API.
  * `sphinx.GetLastWarning()` - Returns the last warning thrown by the Sphinx API.
  * `sphinx.SetServer(host, port)` - sets the API's searchd server location if it isn't the default of localhost:3312
  * `sphinx.SetConnectTimeout(seconds)` - the maximum number of seconds to wait for the Sphinx connection.
  * `sphinx.SetLimits(offset, limit, max, cutoff)` - Much like LIMIT in a SQL query, SetLimits() returns a section of the total results.
  * `sphinx.SetArrayResult(bool)` - configure the client to return results as an associative array.
  * `sphinx._maxmatches` - property that defines the maximum number of matches Sphinx will find.
  * `sphinx.SetMaxQueryTime(time)` -  sets the query timeout to the time in milliseconds.
  * `sphinx.SetMatchMode(mode)` - The matching mode can be set to one of six values: sphinx.SPH\_MATCH\_ALL, sphinx.SPH\_MATCH\_ANY, sphinx.SPH\_MATCH\_PHRASE, sphinx.SPH\_MATCH\_BOOLEAN, sphinx.SPH\_MATCH\_EXTENDED, sphinx.SPH\_MATCH\_EXTENDED2
  * `sphinx.SetRankingMode(mode)` - Sets the ranking mode for weighting. Valid values are: sphinx.SPH\_RANK\_PROXIMITY\_BM25, sphinx.SPH\_RANK\_BM25, sphinx.SPH\_RANK\_NONE
  * `sphinx.SetSortMode(mode, sortby)` - The sorting mode can be one of five values: sphinx.SPH\_SORT\_RELEVANCE, sphinx.SPH\_SORT\_ATTR\_DESC, sphinx.SPH\_SORT\_ATTR\_ASC, sphinx.SPH\_SORT\_TIME\_SEGMENTS, sphinx.SPH\_SORT\_EXTENDED
  * `sphinx.SetWeights(weights)` - this function is deprecated. Use SetFieldWeights() instead.
  * `sphinx.SetFieldWeights(weights)` -  sets the weighting of named columns in your sql\_query by associative array.
  * `sphinx.SetIndexWeights(weights)` - sets the weighting of separate indexes as defined in sphinx.conf when searching. The weights are set via associative array.
  * `sphinx.SetIDRange(min, max)` - Inclusive ranged filter which only shows results which have a document id between min and max (including min and max). Do not use this function for pagination. Use SetLimit() for that functionality.
  * `sphinx.SetFilter(attribute, values, exclude)` - filters returned results by the attributes defined in the indexer configuration. Attributes are string values which list the name of the column to sort by, and values are an array of values to filter with. Exclude is a boolean value to invert matches.
  * `sphinx.SetFilterRange(attribute, min, max, exclude)` -  much like SetFilter(), except it finds values between min and max. It is inclusive of the min and max values. Setting exclude TRUE will invert the search to all values except those between min and max, including min and max.
  * `sphinx.SetFilterFloatRange(attribute, min, max, exclude)` - is identical to SetFilterRange(), only for use with floating point values.
  * `sphinx.SetGeoAnchor(attribute_lat, attribute_long, lat, long)` -  required for use of @geodist in filters and sorting. Distance will be calculated from this point. attribute\_lat and attribute\_long refer to the column name of the latitude and longitude. lat and long must be in radians.
  * `sphinx.SetGroupBy(attribute, function, groupsort)` - In grouping mode, all matches are assigned to different groups based on grouping function value. Each group keeps track of the total match count, and the best match (in this group) according to current sorting function. The final result set contains one best match per group, with the grouping function value and matches count attached. Groups in result set could be sorted by any sorting clause, including both document attributes and the following special internal Sphinx attributes: @id - match document ID; @weight, @rank, @relevance - match weight; @group - groupby function value; @count - amount of matches in group. The default groupsort mode is to sort by groupby function value in descending order, ie. by @group desc. total\_found would contain total amount of matching groups over the whole index.  The grouping function can be: sphinx.SPH\_GROUPBY\_DAY, sphinx.SPH\_GROUPBY\_WEEK, sphinx.SPH\_GROUPBY\_MONTH, sphinx.SPH\_GROUPBY\_YEAR, sphinx.SPH\_GROUPBY\_ATTR, sphinx.SPH\_GROUPBY\_ATTRPAIR
  * `sphinx.SetGroupDistinct(attribute)` - Sets a grouping attribute as count-distinct
  * `sphinx.SetRetries(count, delay)` - sets distributed index retry count and retry delay.
  * `sphinx.ResetFilters()` - Clears all filters.
  * `sphinx.ResetGroupBy()` - Clears all grouping columns and modes.
  * `sphinx.Query(query, index)` - executes a query using the given query and index. index can be blank and will by-default search all indexes. You can limit the search to certain indexes separated by anything other than letters, numbers, underscores, and dashes. The order of the indexes is important. If a document exists in two indexes (i.e. updated document in a delta index), Sphinx will use the last index listed for weight and attributes for sorting and returning to the client. In the above example, documents in the delta index will always be used over those in the main index.
  * `sphinx.AddQuery(query, index)` - has the same parameters as Query(), only it adds the query to a batch which are all executed by RunQueries(). For multiple queries, this reduces network overhead and allows Sphinx to perform internal optimization, especially on group queries with the same query but different group settings.
  * `sphinx.RunQueries()` - used to execute a batch of queries built by AddQuery(). Returns an array with each query's resultant array.
  * `sphinx.BuildExcerpts(documents, index, words, options)` - connects to searchd and generates an array of string excerpts from the indexes. documents is an array of strings which represent the document's contents. index specifies the index from which the settings will be used for stemming, lexing, and case folding. words contains the terms to highlight. options is an array to change the way BuildExcerpts() highlights the specified words, and consists of: before\_match, after\_match, chunk\_separator, limit, around, exact\_phrase, and single\_passage
  * `sphinx.UpdateAttributes(index, attributes, values)` - updates the specified index's document attributes.

## Example usage ##

```
var sphinx = new (require('sphinxapi')).SphinxClient();

sphinx.SetServer('127.0.0.1', 9312);
sphinx.SetConnectTimeout(5);
sphinx.SetMaxQueryTime(10000);
sphinx.SetArrayResult(true);
sphinx.SetMatchMode(sphinx.SPH_MATCH_EXTENDED2);
sphinx.SetLimits(0, 50);
sphinx._maxmatches = 1000000;

var max = parseInt((new Date()).getTime()/1000, 10);
var min = max - 604800; 
sphinx.SetFilterRange('timestamp', min, max, false);
sphinx.SetFilter('qty', [5, 10, 15], false);

var results = sphinx.Query('@body "hello world" @author ta*', 'data');
system.stdout.writeLine(JSON.stringify(results));
```