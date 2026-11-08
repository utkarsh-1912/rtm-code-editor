// LeetCode mode: LeetCode code is a function or a `Solution` class, with no main and no input
// reading, and its examples are written as JSON-like values ([2,7,11,15], "abc", true), one
// argument per line. To run it, we add a small driver that reads each line as one argument,
// turns it into the parameter's type, calls the function and prints the result the way
// LeetCode shows it. Several cases at once: put their lines one after another.
//
// `harness` comes from the problem import: { name, params: [{ name, type }], ret }.

export const HARNESS_LANGS = ["javascript", "typescript", "python", "java", "cpp"];

// Code that already reads input or has its own entry point runs as it is.
const OWN_ENTRY = {
    javascript: /readFileSync\s*\(\s*0|process\.stdin|require\(['"]readline/,
    typescript: /readFileSync\s*\(\s*0|process\.stdin|require\(['"]readline/,
    python: /if\s+__name__\s*==|sys\.stdin|input\s*\(/,
    java: /public\s+static\s+void\s+main\s*\(/,
    cpp: /\bint\s+main\s*\(/,
};

const LIST_TYPES = new Set(["ListNode", "TreeNode"]);

// What a harness can't handle in a language (null = fine).
export function harnessProblem(language, harness) {
    if (!harness?.name || !Array.isArray(harness.params)) return "This problem has no function signature to call.";
    if (!HARNESS_LANGS.includes(language)) return "LeetCode mode supports JavaScript, TypeScript, Python, Java and C++. In other languages, read the input yourself.";
    const types = [...harness.params.map((p) => p.type), harness.ret];
    if ((language === "java" || language === "cpp") && types.some((t) => LIST_TYPES.has(t) || /ListNode|TreeNode/.test(t))) {
        return "Linked lists and trees run in JavaScript, TypeScript and Python for now.";
    }
    if ((language === "java" || language === "cpp") && types.some((t) => !JAVA_TYPES[t] && t !== "void")) {
        return `This problem uses a type LeetCode mode can't build in ${language === "java" ? "Java" : "C++"} yet (${types.find((t) => !JAVA_TYPES[t] && t !== "void")}).`;
    }
    return null;
}

export const hasOwnEntry = (language, code) => !!OWN_ENTRY[language]?.test(code || "");

// ---- JavaScript / TypeScript --------------------------------------------------------------------
function wrapJs(code, h, ts) {
    const types = JSON.stringify(h.params.map((p) => p.type));
    return `${ts ? "// @ts-nocheck\n" : ""}function ListNode(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; }
function TreeNode(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; }
${code}

// ---- LeetCode mode: reads each line as one argument, calls ${h.name}, prints the result ----
;(function () {
  const lines = require("fs").readFileSync(0, "utf8").split(/\\r?\\n/).filter((l) => l.trim() !== "");
  const types = ${types}, ret = ${JSON.stringify(h.ret)};
  const toList = (a) => { let head = null; for (let i = a.length - 1; i >= 0; i--) head = new ListNode(a[i], head); return head; };
  const toTree = (a) => {
    if (!a.length || a[0] === null) return null;
    const root = new TreeNode(a[0]); const q = [root]; let i = 1;
    while (q.length && i < a.length) { const n = q.shift();
      if (i < a.length && a[i] !== null) { n.left = new TreeNode(a[i]); q.push(n.left); } i++;
      if (i < a.length && a[i] !== null) { n.right = new TreeNode(a[i]); q.push(n.right); } i++; }
    return root;
  };
  const conv = (v, t) => t === "ListNode" ? toList(v) : t === "TreeNode" ? toTree(v) : t === "ListNode[]" ? v.map(toList) : v;
  const fromList = (n) => { const a = []; while (n) { a.push(n.val); n = n.next; } return a; };
  const fromTree = (r) => { const a = []; const q = [r]; while (q.length) { const n = q.shift(); if (n) { a.push(n.val); q.push(n.left, n.right); } else a.push(null); } while (a.length && a[a.length - 1] === null) a.pop(); return a; };
  const show = (v, t) => {
    if (t === "ListNode") v = fromList(v); else if (t === "TreeNode") v = fromTree(v);
    if (t === "double" && typeof v === "number") return v.toFixed(5);
    return JSON.stringify(v === undefined ? null : v);
  };
  const call = typeof ${h.name} === "function" ? ${h.name} : (...a) => new Solution().${h.name}(...a);
  if (lines.length < types.length) { console.log("Add the input: one line per argument (" + types.join(", ") + ")."); return; }
  for (let i = 0; i + types.length <= lines.length; i += types.length) {
    const args = types.map((t, j) => conv(JSON.parse(lines[i + j]), t));
    const out = call(...args);
    console.log(ret === "void" ? show(args[0], types[0]) : show(out, ret));
  }
})();
`;
}

// ---- Python ---------------------------------------------------------------------------------------
function wrapPy(code, h) {
    return `from typing import *
import sys, json, math, heapq, bisect, itertools, functools, string, re
from collections import *

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

${code}

# ---- LeetCode mode: reads each line as one argument, calls ${h.name}, prints the result ----
def __lc_main():
    lines = [l for l in sys.stdin.read().splitlines() if l.strip()]
    types = ${JSON.stringify(h.params.map((p) => p.type))}
    ret = ${JSON.stringify(h.ret)}
    def to_list(a):
        head = None
        for v in reversed(a):
            head = ListNode(v, head)
        return head
    def to_tree(a):
        if not a or a[0] is None:
            return None
        root = TreeNode(a[0]); q = deque([root]); i = 1
        while q and i < len(a):
            n = q.popleft()
            if i < len(a) and a[i] is not None:
                n.left = TreeNode(a[i]); q.append(n.left)
            i += 1
            if i < len(a) and a[i] is not None:
                n.right = TreeNode(a[i]); q.append(n.right)
            i += 1
        return root
    def conv(v, t):
        return to_list(v) if t == "ListNode" else to_tree(v) if t == "TreeNode" else [to_list(x) for x in v] if t == "ListNode[]" else v
    def show(v, t):
        if t == "ListNode":
            a = []
            while v:
                a.append(v.val); v = v.next
            v = a
        elif t == "TreeNode":
            a, q = [], deque([v])
            while q:
                n = q.popleft()
                if n:
                    a.append(n.val); q.append(n.left); q.append(n.right)
                else:
                    a.append(None)
            while a and a[-1] is None:
                a.pop()
            v = a
        if t == "double" and isinstance(v, (int, float)):
            return "%.5f" % v
        return json.dumps(v, separators=(",", ":"))
    call = globals()["${h.name}"] if "${h.name}" in globals() else getattr(Solution(), "${h.name}")
    if len(lines) < len(types):
        print("Add the input: one line per argument (" + ", ".join(types) + ").")
        return
    for i in range(0, len(lines) - len(types) + 1, len(types)):
        args = [conv(json.loads(lines[i + j]), t) for j, t in enumerate(types)]
        out = call(*args)
        print(show(args[0], types[0]) if ret == "void" else show(out, ret))

__lc_main()
`;
}

// ---- Java -------------------------------------------------------------------------------------------
// LeetCode type -> [Java type, conversion from the parsed value].
const JAVA_TYPES = {
    "integer": ["int", "((Number) %s).intValue()"],
    "long": ["long", "((Number) %s).longValue()"],
    "double": ["double", "((Number) %s).doubleValue()"],
    "boolean": ["boolean", "(Boolean) %s"],
    "string": ["String", "(String) %s"],
    "character": ["char", "((String) %s).charAt(0)"],
    "integer[]": ["int[]", "J.ints(%s)"],
    "long[]": ["long[]", "J.longs(%s)"],
    "double[]": ["double[]", "J.doubles(%s)"],
    "boolean[]": ["boolean[]", "J.bools(%s)"],
    "string[]": ["String[]", "J.strs(%s)"],
    "character[]": ["char[]", "J.chars(%s)"],
    "integer[][]": ["int[][]", "J.ints2(%s)"],
    "string[][]": ["String[][]", "J.strs2(%s)"],
    "character[][]": ["char[][]", "J.chars2(%s)"],
    "list<integer>": ["List<Integer>", "J.intList(%s)"],
    "list<long>": ["List<Long>", "J.longList(%s)"],
    "list<string>": ["List<String>", "J.strList(%s)"],
    "list<list<integer>>": ["List<List<Integer>>", "J.intList2(%s)"],
    "list<list<string>>": ["List<List<String>>", "J.strList2(%s)"],
};

function wrapJava(code, h) {
    const args = h.params.map((p, i) => `${JAVA_TYPES[p.type][0]} a${i} = ${JAVA_TYPES[p.type][1].replace("%s", `J.parse(lines.get(i + ${i}))`)};`).join("\n            ");
    const call = `new Solution().${h.name}(${h.params.map((_, i) => `a${i}`).join(", ")})`;
    const print = h.ret === "void" ? `${call};\n            System.out.println(J.show(a0, ${JSON.stringify(h.params[0].type)}));` : `System.out.println(J.show(${call}, ${JSON.stringify(h.ret)}));`;
    return `import java.util.*;
import java.util.stream.*;
import java.io.*;

${code}

// ---- LeetCode mode: reads each line as one argument, calls ${h.name}, prints the result ----
class J {
    static int p; static String s;
    static Object parse(String text) { s = text.trim(); p = 0; return val(); }
    static void ws() { while (p < s.length() && Character.isWhitespace(s.charAt(p))) p++; }
    static Object val() {
        ws(); char c = s.charAt(p);
        if (c == '[') { p++; List<Object> a = new ArrayList<>(); ws(); if (s.charAt(p) == ']') { p++; return a; }
            while (true) { a.add(val()); ws(); if (s.charAt(p) == ',') { p++; continue; } p++; return a; } }
        if (c == '"') { StringBuilder b = new StringBuilder(); p++;
            while (s.charAt(p) != '"') { char d = s.charAt(p++); if (d == '\\\\') { char e = s.charAt(p++); b.append(e == 'n' ? '\\n' : e == 't' ? '\\t' : e); } else b.append(d); }
            p++; return b.toString(); }
        if (s.startsWith("true", p)) { p += 4; return true; }
        if (s.startsWith("false", p)) { p += 5; return false; }
        if (s.startsWith("null", p)) { p += 4; return null; }
        int st = p; while (p < s.length() && "+-.0123456789eE".indexOf(s.charAt(p)) >= 0) p++;
        String n = s.substring(st, p);
        if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.parseDouble(n);
        return Long.parseLong(n);
    }
    @SuppressWarnings("unchecked") static List<Object> L(Object o) { return (List<Object>) o; }
    static int[] ints(Object o) { return L(o).stream().mapToInt(x -> ((Number) x).intValue()).toArray(); }
    static long[] longs(Object o) { return L(o).stream().mapToLong(x -> ((Number) x).longValue()).toArray(); }
    static double[] doubles(Object o) { return L(o).stream().mapToDouble(x -> ((Number) x).doubleValue()).toArray(); }
    static boolean[] bools(Object o) { List<Object> l = L(o); boolean[] r = new boolean[l.size()]; for (int i = 0; i < r.length; i++) r[i] = (Boolean) l.get(i); return r; }
    static String[] strs(Object o) { return L(o).stream().map(x -> (String) x).toArray(String[]::new); }
    static char[] chars(Object o) { List<Object> l = L(o); char[] r = new char[l.size()]; for (int i = 0; i < r.length; i++) r[i] = ((String) l.get(i)).charAt(0); return r; }
    static int[][] ints2(Object o) { return L(o).stream().map(J::ints).toArray(int[][]::new); }
    static String[][] strs2(Object o) { return L(o).stream().map(J::strs).toArray(String[][]::new); }
    static char[][] chars2(Object o) { return L(o).stream().map(J::chars).toArray(char[][]::new); }
    static List<Integer> intList(Object o) { return L(o).stream().map(x -> ((Number) x).intValue()).collect(Collectors.toList()); }
    static List<Long> longList(Object o) { return L(o).stream().map(x -> ((Number) x).longValue()).collect(Collectors.toList()); }
    static List<String> strList(Object o) { return L(o).stream().map(x -> (String) x).collect(Collectors.toList()); }
    static List<List<Integer>> intList2(Object o) { return L(o).stream().map(J::intList).collect(Collectors.toList()); }
    static List<List<String>> strList2(Object o) { return L(o).stream().map(J::strList).collect(Collectors.toList()); }
    static String q(String x) { return "\\"" + x.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\""; }
    static String show(Object v, String t) {
        if (v == null) return "null";
        if (t.equals("double") && v instanceof Number) return String.format("%.5f", ((Number) v).doubleValue());
        if (v instanceof String) return q((String) v);
        if (v instanceof Character) return q(String.valueOf(v));
        if (v instanceof int[]) return Arrays.stream((int[]) v).mapToObj(String::valueOf).collect(Collectors.joining(",", "[", "]"));
        if (v instanceof long[]) return Arrays.stream((long[]) v).mapToObj(String::valueOf).collect(Collectors.joining(",", "[", "]"));
        if (v instanceof double[]) return Arrays.stream((double[]) v).mapToObj(d -> String.format("%.5f", d)).collect(Collectors.joining(",", "[", "]"));
        if (v instanceof boolean[]) { boolean[] b = (boolean[]) v; StringJoiner j = new StringJoiner(",", "[", "]"); for (boolean x : b) j.add(String.valueOf(x)); return j.toString(); }
        if (v instanceof char[]) { char[] c = (char[]) v; StringJoiner j = new StringJoiner(",", "[", "]"); for (char x : c) j.add(q(String.valueOf(x))); return j.toString(); }
        if (v instanceof Object[]) { StringJoiner j = new StringJoiner(",", "[", "]"); for (Object x : (Object[]) v) j.add(show(x, "")); return j.toString(); }
        if (v instanceof Collection) { StringJoiner j = new StringJoiner(",", "[", "]"); for (Object x : (Collection<?>) v) j.add(show(x, "")); return j.toString(); }
        return String.valueOf(v);
    }
}

public class Main {
    public static void main(String[] argv) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        List<String> lines = new ArrayList<>(); String line;
        while ((line = in.readLine()) != null) if (!line.trim().isEmpty()) lines.add(line);
        int n = ${h.params.length};
        if (lines.size() < n) { System.out.println("Add the input: one line per argument (${h.params.map((p) => p.type).join(", ")})."); return; }
        for (int i = 0; i + n <= lines.size(); i += n) {
            ${args}
            ${print}
        }
    }
}
`;
}

// ---- C++ ----------------------------------------------------------------------------------------------
const CPP_TYPES = {
    "integer": "int", "long": "long long", "double": "double", "boolean": "bool", "string": "string", "character": "char",
    "integer[]": "vector<int>", "long[]": "vector<long long>", "double[]": "vector<double>", "boolean[]": "vector<bool>",
    "string[]": "vector<string>", "character[]": "vector<char>",
    "integer[][]": "vector<vector<int>>", "string[][]": "vector<vector<string>>", "character[][]": "vector<vector<char>>",
    "list<integer>": "vector<int>", "list<long>": "vector<long long>", "list<string>": "vector<string>",
    "list<list<integer>>": "vector<vector<int>>", "list<list<string>>": "vector<vector<string>>",
};

function wrapCpp(code, h) {
    const args = h.params.map((p, i) => `${CPP_TYPES[p.type]} a${i}; __lc::get(__lc::parse(lines[i + ${i}]), a${i});`).join("\n        ");
    const call = `Solution().${h.name}(${h.params.map((_, i) => `a${i}`).join(", ")})`;
    const print = h.ret === "void"
        ? `${call};\n        __lc::show(cout, a0${h.params[0].type === "double" ? ", true" : ""}); cout << "\\n";`
        : `{ auto __r = ${call}; __lc::show(cout, __r${h.ret === "double" ? ", true" : ""}); cout << "\\n"; }`;
    return `#include <bits/stdc++.h>
using namespace std;

${code}

// ---- LeetCode mode: reads each line as one argument, calls ${h.name}, prints the result ----
namespace __lc {
struct V { int k = 0; long double n = 0; bool b = false; string s; vector<V> a; }; // k: 0 null, 1 num, 2 bool, 3 str, 4 arr
size_t p; string s;
void ws() { while (p < s.size() && isspace((unsigned char) s[p])) p++; }
V val() {
    ws(); V v;
    if (s[p] == '[') { p++; v.k = 4; ws(); if (s[p] == ']') { p++; return v; }
        while (true) { v.a.push_back(val()); ws(); if (s[p] == ',') { p++; continue; } p++; return v; } }
    if (s[p] == '"') { p++; v.k = 3; while (s[p] != '"') { char c = s[p++]; if (c == '\\\\') { char e = s[p++]; v.s += e == 'n' ? '\\n' : e == 't' ? '\\t' : e; } else v.s += c; } p++; return v; }
    if (s.compare(p, 4, "true") == 0) { p += 4; v.k = 2; v.b = true; return v; }
    if (s.compare(p, 5, "false") == 0) { p += 5; v.k = 2; return v; }
    if (s.compare(p, 4, "null") == 0) { p += 4; return v; }
    size_t st = p; while (p < s.size() && string("+-.0123456789eE").find(s[p]) != string::npos) p++;
    v.k = 1; v.n = stold(s.substr(st, p - st)); return v;
}
V parse(const string& t) { s = t; p = 0; return val(); }
void get(const V& v, int& x) { x = (int) v.n; }
void get(const V& v, long long& x) { x = (long long) v.n; }
void get(const V& v, double& x) { x = (double) v.n; }
void get(const V& v, bool& x) { x = v.b; }
void get(const V& v, string& x) { x = v.s; }
void get(const V& v, char& x) { x = v.s.empty() ? 0 : v.s[0]; }
template <class T> void get(const V& v, vector<T>& x) { x.clear(); for (auto& e : v.a) { T t; get(e, t); x.push_back(t); } }
void get(const V& v, vector<bool>& x) { x.clear(); for (auto& e : v.a) x.push_back(e.b); }
void show(ostream& o, int x, bool = false) { o << x; }
void show(ostream& o, long long x, bool = false) { o << x; }
void show(ostream& o, double x, bool dbl = false) { if (dbl) o << fixed << setprecision(5) << x; else o << x; }
void show(ostream& o, bool x, bool = false) { o << (x ? "true" : "false"); }
void show(ostream& o, const string& x, bool = false) { o << '"' << x << '"'; }
void show(ostream& o, char x, bool = false) { o << '"' << x << '"'; }
template <class T> void show(ostream& o, const vector<T>& x, bool dbl = false) { o << '['; for (size_t i = 0; i < x.size(); i++) { if (i) o << ','; show(o, (T) x[i], dbl); } o << ']'; }
}

int main() {
    vector<string> lines; string line;
    while (getline(cin, line)) { bool blank = true; for (char c : line) if (!isspace((unsigned char) c)) blank = false; if (!blank) lines.push_back(line); }
    const size_t n = ${h.params.length};
    if (lines.size() < n) { cout << "Add the input: one line per argument (${h.params.map((p) => p.type).join(", ")}).\\n"; return 0; }
    for (size_t i = 0; i + n <= lines.size(); i += n) {
        ${args}
        ${print}
    }
    return 0;
}
`;
}

// The source to run: the code wrapped in a driver, or null when it should run as it is.
export function wrapForLeetCode(language, code, harness) {
    if (harnessProblem(language, harness) || hasOwnEntry(language, code)) return null;
    if (language === "javascript") return wrapJs(code, harness, false);
    if (language === "typescript") return wrapJs(code, harness, true);
    if (language === "python") return wrapPy(code, harness);
    if (language === "java") return wrapJava(code, harness);
    if (language === "cpp") return wrapCpp(code, harness);
    return null;
}

// "nums: integer[], target: integer" for the I/O panel.
export const signature = (h) => `${h.name}(${h.params.map((p) => `${p.name}: ${p.type}`).join(", ")})`;
