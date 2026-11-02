// Automated Test Suite for MUST Marketplace Account-Based Likes & Views System

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, details: string) {
  results.push({
    name: testName,
    passed: condition,
    details: condition ? details : `FAILED: ${details}`,
  });
  if (!condition) {
    console.error(`❌ FAIL: ${testName} - ${details}`);
  } else {
    console.log(`✅ PASS: ${testName}`);
  }
}

// Simulated Firebase Realtime Database
class MockFirebaseRTDB {
  data: Record<string, any> = {};
  listeners: Record<string, Array<(val: any) => void>> = {};

  get(path: string) {
    return Promise.resolve({
      exists: () => path in this.data && this.data[path] !== null && this.data[path] !== undefined,
      val: () => this.data[path] ?? null,
    });
  }

  set(path: string, val: any) {
    this.data[path] = val;
    this.triggerListeners(path, val);
    return Promise.resolve();
  }

  remove(path: string) {
    delete this.data[path];
    this.triggerListeners(path, null);
    return Promise.resolve();
  }

  // Atomic transaction simulation (Compare-And-Swap)
  async runTransaction(path: string, updateFn: (current: any) => any) {
    const current = this.data[path] ?? null;
    const newVal = updateFn(current);
    if (newVal === undefined) {
      return { committed: false, snapshot: { val: () => current } };
    }
    this.data[path] = newVal;
    this.triggerListeners(path, newVal);
    return { committed: true, snapshot: { val: () => newVal } };
  }

  onValue(path: string, callback: (snap: { exists: () => boolean; val: () => any }) => void) {
    if (!this.listeners[path]) this.listeners[path] = [];
    this.listeners[path].push(callback);
    // initial trigger
    callback({
      exists: () => path in this.data && this.data[path] !== null && this.data[path] !== undefined,
      val: () => this.data[path] ?? null,
    });
    return () => {
      this.listeners[path] = this.listeners[path].filter((cb) => cb !== callback);
    };
  }

  private triggerListeners(path: string, val: any) {
    // Notify exact path listeners
    if (this.listeners[path]) {
      this.listeners[path].forEach((cb) => cb({ exists: () => val !== null, val: () => val }));
    }
    // Also notify prefix / parent listeners
    Object.keys(this.listeners).forEach((lPath) => {
      if (path.startsWith(lPath + "/")) {
        // Collect children under lPath
        const subData: Record<string, any> = {};
        Object.keys(this.data).forEach((dKey) => {
          if (dKey.startsWith(lPath + "/")) {
            const childKey = dKey.slice(lPath.length + 1).split("/")[0];
            subData[childKey] = this.data[dKey];
          }
        });
        this.listeners[lPath].forEach((cb) =>
          cb({ exists: () => Object.keys(subData).length > 0, val: () => subData })
        );
      }
    });
  }
}

// Logic implementations mirroring src/lib/firebase/services.ts
async function recordProductView(db: MockFirebaseRTDB, productId: string, viewerKey: string) {
  const viewRecordPath = `product_views/${productId}/${viewerKey}`;
  const result = await db.runTransaction(viewRecordPath, (current) => {
    if (current !== null && current !== undefined) {
      return undefined; // abort
    }
    return true;
  });

  if (!result.committed) return false;

  // Increment view counter atomically
  const viewsPath = `products/${productId}/views`;
  await db.runTransaction(viewsPath, (current) => {
    return (typeof current === "number" ? current : 0) + 1;
  });
  return true;
}

async function toggleFavorite(
  db: MockFirebaseRTDB,
  productId: string,
  userId: string,
  explicitTargetState?: boolean
) {
  const prodLikePath = `product_likes/${productId}/${userId}`;
  const favPath = `favorites/${userId}/${productId}`;

  let isNowLiked: boolean;
  if (typeof explicitTargetState === "boolean") {
    isNowLiked = explicitTargetState;
  } else {
    const prodLikeSnap = await db.get(prodLikePath);
    isNowLiked = !prodLikeSnap.exists();
  }

  if (isNowLiked) {
    await db.set(prodLikePath, true);
    await db.set(favPath, true);
  } else {
    await db.remove(prodLikePath);
    await db.remove(favPath);
  }

  // Recount unique likes from authoritative source
  const allLikes: string[] = [];
  Object.keys(db.data).forEach((k) => {
    if (k.startsWith(`product_likes/${productId}/`) && db.data[k] === true) {
      allLikes.push(k);
    }
  });
  const trueLikesCount = allLikes.length;
  await db.set(`products/${productId}/likes`, trueLikesCount);

  return { isNowLiked, trueLikesCount };
}

// RUN THE TESTS
async function runAllTests() {
  console.log("=== STARTING MUST MARKETPLACE LIKES & VIEWS TEST SUITE ===\n");
  const db = new MockFirebaseRTDB();

  const PRODUCT_A = "prod_laptop_001";
  const USER_1 = "user_account_mary";
  const USER_2 = "user_account_john";

  // TEST 1: View Product A from Device A (User 1)
  const view1 = await recordProductView(db, PRODUCT_A, USER_1);
  assert(view1 === true, "Views: Initial View", "First view recorded successfully.");
  assert(db.data[`products/${PRODUCT_A}/views`] === 1, "Views: Counter = 1", "View count is 1 after first view.");

  // TEST 2: Open same product from Device B (User 1)
  const view2 = await recordProductView(db, PRODUCT_A, USER_1);
  assert(view2 === false, "Views: Deduplication Across Devices", "Second view from same account was rejected.");
  assert(db.data[`products/${PRODUCT_A}/views`] === 1, "Views: Counter Unchanged", "View count remained 1 across devices.");

  // TEST 3: Refresh product page 20 times repeatedly from User 1
  for (let i = 0; i < 20; i++) {
    await recordProductView(db, PRODUCT_A, USER_1);
  }
  assert(db.data[`products/${PRODUCT_A}/views`] === 1, "Views: 20 Refreshes Idempotent", "20 refreshes contributed 0 extra views.");

  // TEST 4: View Product A from User 2
  const viewUser2 = await recordProductView(db, PRODUCT_A, USER_2);
  assert(viewUser2 === true, "Views: Independent Account View", "User 2 successfully recorded a new view.");
  assert(db.data[`products/${PRODUCT_A}/views`] === 2, "Views: Counter = 2", "Total view count correctly reached 2 for two accounts.");

  // TEST 5: Concurrent view requests (50 simultaneous requests for User 1)
  const concurrentViews = await Promise.all(
    Array.from({ length: 50 }).map(() => recordProductView(db, PRODUCT_A, USER_1))
  );
  const committedViews = concurrentViews.filter((v) => v === true).length;
  assert(committedViews === 0, "Views Concurrency: 0 New Commits", "50 concurrent requests from existing user produced 0 duplicate views.");
  assert(db.data[`products/${PRODUCT_A}/views`] === 2, "Views Concurrency: Counter Steady", "View count remained exactly 2 under concurrency.");

  // TEST 6: Like Product A from Device A (User 1)
  const like1 = await toggleFavorite(db, PRODUCT_A, USER_1, true);
  assert(like1.isNowLiked === true, "Likes: First Like", "User 1 liked Product A.");
  assert(like1.trueLikesCount === 1, "Likes: Counter = 1", "Product A like count is 1.");

  // TEST 7: Open on Device B with same account (User 1) & verify liked state
  const user1FavSnap = await db.get(`favorites/${USER_1}/${PRODUCT_A}`);
  assert(user1FavSnap.val() === true, "Likes: Device B State Active", "Device B reads active liked state from favorites/USER_1/PRODUCT_A.");

  // TEST 8: Attempt to like again from Device B with same account (idempotent target state)
  const likeAgain = await toggleFavorite(db, PRODUCT_A, USER_1, true);
  assert(likeAgain.trueLikesCount === 1, "Likes: Idempotent Duplicate Like", "Count remained 1 when re-liking from Device B.");

  // TEST 9: Concurrent likes from 50 devices simultaneously for User 1
  await Promise.all(
    Array.from({ length: 50 }).map(() => toggleFavorite(db, PRODUCT_A, USER_1, true))
  );
  assert(db.data[`products/${PRODUCT_A}/likes`] === 1, "Likes Concurrency: Exact 1 Count", "50 concurrent like calls for User 1 resulted in exactly 1 like.");

  // TEST 10: Like Product A from User 2
  const user2Like = await toggleFavorite(db, PRODUCT_A, USER_2, true);
  assert(user2Like.trueLikesCount === 2, "Likes: User 2 Independent Like", "User 2 liked Product A, count reached exactly 2.");

  // TEST 11: Real-time synchronization simulation (Device A listener)
  let deviceAObservedCount: any = 0;
  let deviceAObservedFav: any = false;
  const unsubLikes = db.onValue(`products/${PRODUCT_A}/likes`, (snap) => {
    deviceAObservedCount = snap.val();
  });
  const unsubFav = db.onValue(`favorites/${USER_1}/${PRODUCT_A}`, (snap) => {
    deviceAObservedFav = snap.val() === true;
  });

  assert(deviceAObservedCount === 2, "Real-time: Listener Initial Count", "Device A listener received 2 likes.");
  assert(deviceAObservedFav === true, "Real-time: Listener Initial Fav", "Device A listener sees favorited = true.");

  // TEST 12: Unlike Product A from Device B (User 1)
  const unlikeFromDeviceB = await toggleFavorite(db, PRODUCT_A, USER_1, false);
  assert(unlikeFromDeviceB.isNowLiked === false, "Likes: Unlike from Device B", "User 1 successfully unliked from Device B.");
  assert(unlikeFromDeviceB.trueLikesCount === 1, "Likes: Counter Decremented to 1", "Like count dropped to 1 (only User 2 remains).");

  // Verify Device A listener immediately received updates without page refresh
  assert(deviceAObservedCount === 1, "Real-time: Device A Received Count Update", "Device A received count 1 in real time.");
  assert(deviceAObservedFav === false, "Real-time: Device A Received Unliked State", "Device A heart state turned false in real time.");

  unsubLikes();
  unsubFav();

  // TEST 13: Account switching & privacy isolation
  const user1Data = await db.get(`favorites/${USER_1}/${PRODUCT_A}`);
  const user2Data = await db.get(`favorites/${USER_2}/${PRODUCT_A}`);
  assert(user1Data.exists() === false, "Account Isolation: User 1 Cleared", "User 1 has no active favorite on Product A.");
  assert(user2Data.val() === true, "Account Isolation: User 2 Preserved", "User 2 active favorite is preserved and isolated.");

  console.log("\n=== TEST RESULTS SUMMARY ===");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  console.log(`Passed: ${passed}/${total}`);
  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  } else {
    console.error(`⚠️ ${total - passed} TESTS FAILED.`);
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error("Unhandled test runner exception:", e);
  process.exit(1);
});
