import { CacheHandler } from "@neshca/cache-handler";
import { isImplicitTag } from "@neshca/cache-handler/helpers";
import { createClient, commandOptions } from "redis";

CacheHandler.onCreation(async () => {
  // Always create a Redis client inside the `onCreation` callback.
  const client = createClient({
    url: process.env.REDIS_URL,
  });

  console.log("init cache ...");

  // Redis won't work without error handling. https://github.com/redis/node-redis?tab=readme-ov-file#events
  client.on("error", (error) => {
    if (typeof process.env.NEXT_PRIVATE_DEBUG_CACHE !== "undefined") {
      // Use logging with caution in production. Redis will flood your logs. Hide it behind a flag.
      console.error("Redis client error:", error);
    }
  });

  await client.connect();

  // Define a timeout for Redis operations.
  const timeoutMs = 1000;

  // Define a key prefix for the cache.
  // It is useful to avoid key collisions with other data in Redis,
  // or to delete all cache keys at once by using a pattern.
  const keyPrefix = "my-app-cache:";

  // Define a key for shared tags.
  // You'll see how to use it later in the `revalidateTag` method
  const sharedTagsKey = "_sharedTags_";

  // Create an assert function to ensure that the client is ready before using it.
  // When you throw an error in any Handler method,
  // the CacheHandler will use the next available Handler listed in the `handlers` array.
  function assertClientIsReady() {
    if (!client.isReady) {
      throw new Error("Redis client is not ready yet or connection is lost.");
    }
  }

  const revalidatedTagsKey = `${keyPrefix}__revalidated_tags__`;

  // Create a custom Redis Handler
  const customRedisHandler = {
    // Give the handler a name.
    // It is useful for logging in debug mode.
    name: "redis-strings-custom",
    // We do not use try/catch blocks in the Handler methods.
    // CacheHandler will handle errors and use the next available Handler.
    async get(key, { implicitTags }) {
      // Ensure that the client is ready before using it.
      // If the client is not ready, the CacheHandler will use the next available Handler.
      assertClientIsReady();

      // Create a new AbortSignal with a timeout for the Redis operation.
      // By default, redis client operations will wait indefinitely.
      const options = commandOptions({
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Get the value from Redis.
      // We use the key prefix to avoid key collisions with other data in Redis.
      const result = await client.get(options, keyPrefix + key);

      // If the key does not exist, return null.
      if (!result) {
        return null;
      }

      // Redis stores strings, so we need to parse the JSON.
      const cacheValue = JSON.parse(result);

      // If the cache value has no tags, return it early.
      if (!cacheValue) {
        return null;
      }

      // Get the set of explicit and implicit tags.
      // implicitTags are available only on the `get` method.
      const combinedTags = new Set([...cacheValue.tags, ...implicitTags]);

      // If there are no tags, return the cache value early.
      if (combinedTags.size === 0) {
        return cacheValue;
      }

      // Get the revalidation times for the tags.
      const revalidationTimes = await client.hmGet(
        commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
        revalidatedTagsKey,
        Array.from(combinedTags)
      );

      // Iterate over all revalidation times.
      for (const timeString of revalidationTimes) {
        // If the revalidation time is greater than the last modified time of the cache value,
        if (
          timeString &&
          Number.parseInt(timeString, 10) > cacheValue.lastModified
        ) {
          // Delete the key from Redis.
          await client.unlink(
            commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
            keyPrefix + key
          );

          // Return null to indicate cache miss.
          return null;
        }
      }

      // Return the cache value.
      return cacheValue;
    },
    async set(key, cacheHandlerValue) {
      // Ensure that the client is ready before using it.
      assertClientIsReady();

      // Create a new AbortSignal with a timeout for the Redis operation.
      const options = commandOptions({
        signal: AbortSignal.timeout(timeoutMs),
      });

      // Redis stores strings, so we need to stringify the JSON.
      const setOperation = client.set(
        options,
        keyPrefix + key,
        JSON.stringify(cacheHandlerValue)
      );

      // If the cacheHandlerValue has a lifespan, set the automatic expiration.
      // cacheHandlerValue.lifespan can be null if the value is the page from the Pages Router without getStaticPaths or with `fallback: false`
      // so, we need to check if it exists before using it
      const expireOperation = cacheHandlerValue.lifespan
        ? client.expireAt(
            options,
            keyPrefix + key,
            cacheHandlerValue.lifespan.expireAt
          )
        : undefined;

      // If the cache handler value has tags, set the tags.
      // We store them separately to save time to retrieve them in the `revalidateTag` method.
      const setTagsOperation = cacheHandlerValue.tags.length
        ? client.hSet(
            options,
            keyPrefix + sharedTagsKey,
            key,
            JSON.stringify(cacheHandlerValue.tags)
          )
        : undefined;

      // Wait for all operations to complete.
      await Promise.all([setOperation, expireOperation, setTagsOperation]);
    },
    async revalidateTag(tag) {
      // Ensure that the client is ready before using it.
      assertClientIsReady();

      // Check if the tag is implicit.
      // Implicit tags are not stored in the cached values.
      if (isImplicitTag(tag)) {
        // Mark the tag as revalidated at the current time.
        await client.hSet(
          commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
          revalidatedTagsKey,
          tag,
          Date.now()
        );
      }

      // Create a map to store the tags for each key.
      const tagsMap = new Map();

      // Cursor for the hScan operation.
      let cursor = 0;

      // Define a query size for the hScan operation.
      const hScanOptions = { COUNT: 100 };

      // Iterate over all keys in the shared tags.
      do {
        const remoteTagsPortion = await client.hScan(
          commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
          keyPrefix + sharedTagsKey,
          cursor,
          hScanOptions
        );

        // Iterate over all keys in the portion.
        for (const { field, value } of remoteTagsPortion.tuples) {
          // Parse the tags from the value.
          tagsMap.set(field, JSON.parse(value));
        }

        // Update the cursor for the next iteration.
        cursor = remoteTagsPortion.cursor;

        // If the cursor is 0, we have reached the end.
      } while (cursor !== 0);

      // Create an array of keys to delete.
      const keysToDelete = [];

      // Create an array of tags to delete from the hash map.
      const tagsToDelete = [];

      // Iterate over all keys and tags.
      for (const [key, tags] of tagsMap) {
        // If the tags include the specified tag, add the key to the delete list.
        if (tags.includes(tag)) {
          // Key must be prefixed because we use the key prefix in the set method.
          keysToDelete.push(keyPrefix + key);
          // Set an empty string as the value for the revalidated tag.
          tagsToDelete.push(key);
        }
      }

      // If there are no keys to delete, return early.
      if (keysToDelete.length === 0) {
        return;
      }

      // Delete the keys from Redis.
      const deleteKeysOperation = client.unlink(
        commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
        keysToDelete
      );

      // Update the tags in Redis by deleting the revalidated tags.
      const updateTagsOperation = client.hDel(
        // Use the isolated option to prevent the command from being executed on the main connection.
        {
          isolated: true,
          ...commandOptions({ signal: AbortSignal.timeout(timeoutMs) }),
        },
        keyPrefix + sharedTagsKey,
        tagsToDelete
      );

      // Wait for all operations to complete.
      await Promise.all([deleteKeysOperation, updateTagsOperation]);
    },
  };

  return {
    // The order of the handlers is important.
    // The CacheHandler will run get methods in the order of the handlers array.
    // Other methods will be run in parallel.
    handlers: [customRedisHandler],
  };
});

export default CacheHandler;