# Redis module #

Defined in file `redis.js`

Classes: **Redis**.


  * `var redis = new Redis([host:host, port:port, password:password, db:db])` - Create a new Redis instance. All arguments optional and default to 127.0.0.1, 6379, '', and 0 respectively.
  * `redis.query(str)` - Queries Redis and returns the result in an array or null on error.
  * `redis.status` - the status or error message due to the last query
  * `redis.rows` - the number of results due to the last query
  * `redis.disconnect()` - closes the connection with Redis