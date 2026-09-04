/** Small unified diffs used across the analyzer tests. */
export const NEW_EXPORT_DIFF = `diff --git a/src/util/format.ts b/src/util/format.ts
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/src/util/format.ts
@@ -0,0 +1,3 @@
+export function formatMoney(cents: number): string {
+  return (cents / 100).toFixed(2);
+}
`;

export const PII_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,4 +10,7 @@ export async function login(user: User) {
   const session = await start(user);
+  console.log(user.email);
+  analytics.track('login', { phone: user.phone });
+  const safe = user.id;
   return session;
 }
`;

export const ROUTE_DIFF = `diff --git a/src/routes/export.ts b/src/routes/export.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/routes/export.ts
@@ -0,0 +1,4 @@
+import { Router } from './router.js';
+export const exportRouter = new Router();
+exportRouter.get('/api/export', handler);
+app.post('/api/export/csv', csvHandler);
`;

export const MIXED_DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a, b };
diff --git a/src/removed.ts b/src/removed.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/removed.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-export const gone = true;
`;
