# MySQL module #

Defined in file `mysql.so` or `mysql.dll` or `mysql.dylib`.

Classes: **MySQL**.

  * `var db = new MySQL(noAutoClose)` - creates new mysql instance. When the first argument is truthy, the connection won't auto-close on exit
  * `db.queryCount` - number of executed queries
  * `db.connect(host, user, password, db)` - connects to database
  * `db.close()` - closes connection to server
  * `db.affectedRows()` - returns number of rows affected by a query
  * `db.insertId()` - returns ID of last inserted row
  * `db.escape(str)` - escapes a string so it can be used in a query

  * `var r = db.query(query)` - executes a query
  * `var r = db.nextResult()` - retrieves next result from a multi-result set
  * `r.numRows()` - returns number of rows in query result
  * `r.numFields()` - returns number of fields in query result
  * `r.fetchNames()` - returns an array with field names
  * `r.fetchArrays()` - returns query results as an array of arrays
  * `r.fetchObjects()` - returns query results as an array of hashes
  * `r.close()` - closes the result and deallocates its memory

  * `MySQL.storeConnection("storage key", db)` - store a persistent connection under a given key
  * `var db2 = MySQL.loadConnection("storage key")` - load a previously saved persistent connection