## Ultimate Thymeleaf Syntax Cheat Sheet & Comprehensive Reference## 1. Standard Expression Syntax## Standard Expressions

* ${...}: Variable expressions (Spring EL / OGNL). Retrieves model attributes.
* *{...}: Selection variable expressions. Evaluates properties relative to a pre-selected object (th:object).
* #{...}: Message expressions. Retrieves externalized text from resource bundles (messages.properties) for localization.
* @{...}: Link URL expressions. Rewrites server URLs, injecting context paths, session IDs, and request parameters.
* ~{...}: Fragment expressions. References reusable UI layout fragments.

## Literals & Operations

* Text Literals: 'Single quotes for literal text'
* Number Literals: 0, 34, 3.14
* Boolean Literals: true, false
* Null Literal: null
* Literal Tokens: user.id, active (No quotes needed if alphanumeric, clean, and without spaces)
* String Concatenation: + operator or Literal Substitution |Hello, ${user.name}!|
* Arithmetic: +, -, *, /, %
* Comparisons / Relational Operators: >, <, >=, <= (or gt, lt, ge, le)
* Equality Operators: ==, != (or eq, ne)
* Conditional Operators:
* Ternary: (condition) ? 'trueValue' : 'falseValue'
   * Elvis (Default): ${user.name} ?: 'Default Name'
   * No-Operation (No-Op): ${user.name} ?: _ (Leaves the default prototype HTML text untouched)

------------------------------
## 2. Text & Attribute Manipulation## Text Output

* th:text: Escapes special HTML characters (e.g., converting < to &lt;).
* th:utext: Renders text unescaped. Processes raw HTML strings.
* Inlining: Eliminates HTML wrapper tags.
* [[${variable}]]: Equivalent to th:text
   * [(${variable})]: Equivalent to th:utext

<p th:text="${user.bio}">Default fallback biography text.</p>
<div th:utext="${htmlSnippet}">Raw markup renders here.</div>
<p>Welcome back, [[${user.name}]]!</p>

## Attribute Modification

* th:attr: Assigns specific values to individual attributes (e.g., th:attr="src=@{/img},alt=${title}").
* Specific Attributes: Replaces target attributes natively (e.g., th:src, th:href, th:value, th:checked, th:disabled, th:id, th:name).
* th:attrappend & th:attrprepend: appends or prepends values to an existing attribute.
* th:classappend: Safely adds a CSS class name without overwriting existing element classes.

<a th:href="@{/order/details(id=${order.id})}">View Order</a>
<input type="checkbox" name="active" th:checked="${user.isActive}" />
<button class="btn" th:classappend="${user.isAdmin} ? 'btn-danger' : 'btn-primary'">Submit</button>

------------------------------
## 3. Conditional Evaluation## Conditionals & Selection

* th:if: Renders the element and its children only if the statement evaluates to true.
* th:unless: Inverse of th:if. Renders the element only if the condition evaluates to false.
* th:switch / th:case: Controls conditional structural multi-selection blocks. use * as the default fallback case.

<div th:if="${user.age >= 18}">Content for adults</div>
<div th:unless="${user.hasSubscription}">Show upgrade banner</div>

<div th:switch="${user.role}">
  <p th:case="'ADMIN'">Full Admin access granted.</p>
  <p th:case="'MANAGER'">Limited management access granted.</p>
  <p th:case="*">Standard user access granted.</p>
</div>

------------------------------
## 4. Iteration (Loops)## Collection Looping
Repeats elements using th:each. Handles Lists, Maps, Sets, and Enumerations.

<table>
  <thead>
    <tr>
      <th>Count</th>
      <th>Index</th>
      <th>Product Name</th>
      <th>Price</th>
    </tr>
  </thead>
  <tbody>
    <tr th:each="product, status : ${products}">
      <td th:text="${status.count}">1</td>
      <td th:text="${status.index}">0</td>
      <td th:text="${product.name}">Product Name</td>
      <td th:text="${product.price}">0.00</td>
    </tr>
  </tbody>
</table>

## Iteration Status Properties (status)

* index: Current zero-based index.
* count: Current one-based index.
* size: Total element count in the target collection.
* current: The current element instance being evaluated.
* even / odd: Boolean evaluation flags for row zoning.
* first / last: Boolean check flags highlighting structural list boundaries.

## Implicit Status Variable
If an explicit status variable is omitted, an implicit runtime tracking helper is created using the element variable name plus the suffix Stat:

<li th:each="user : ${users}" th:text="${userStat.count} + ': ' + ${user.name}"></li>

------------------------------
## 5. Map & Fixed Range Iteration## Map Iteration
Iterates over key-value pairs (java.util.Map). Use .key and .value variables on the tracking variable.

<ul>
  <li th:each="entry : ${settingsMap}">
    <span th:text="${entry.key}">Setting Key</span>: 
    <span th:text="${entry.value}">Setting Value</span>
  </li>
</ul>

## Integer Sequences (For-Loops)
Generates fixed numerical interval collections using utility sequence definitions.

<nav>
  <ul class="pagination">
    <li th:each="pageNumber : ${#numbers.sequence(1, totalPages)}">
      <a th:href="@{/items(page=${pageNumber})}" th:text="${pageNumber}">1</a>
    </li>
  </ul>
</nav>

------------------------------
## 6. Form Binding (Spring Boot Integration)## Commands & Controls

* th:object: Selects a model object command target to bind the form structure to.
* th:field: Binds specific component properties to individual markup fields. Automates generation of element id, name, and value attributes.
* th:errors: Outputs validation error messages bound to targeted field structures.
* th:errorclass: Adds a customized CSS class to the host element if validation criteria fail.

<form th:action="@{/profile/save}" th:object="${profileForm}" method="post">
  <div>
    <label for="username">Username:</label>
    <input type="text" th:field="*{username}" th:errorclass="field-error" />
    <span th:if="${#fields.hasErrors('username')}" th:errors="*{username}">Invalid Username</span>
  </div>

  <div>
    <label for="accountType">Account Type:</label>
    <select th:field="*{accountType}">
      <option th:value="'FREE'">Free Tier</option>
      <option th:value="'PREMIUM'">Premium Tier</option>
    </select>
  </div>
  
  <button type="submit">Save Changes</button>
</form>

------------------------------
## 7. Layouts & Template Fragments## Fragment Mechanics

* th:fragment: Defines a reusable code fragment component within a file.
* th:insert: Places the external fragment inside the body of the current host element tag.
* th:replace: Completely substitutes the current host element tag with the targeted fragment code block.
* th:include: Similar to th:insert, but only inserts the structural content of the fragment (Deprecated since Thymeleaf 3.0, use th:insert).

## Syntax Formats

* ~{filename :: fragmentName}: References a explicitly named fragment inside a target template.
* ~{filename :: #elementId}: Selects an element matching a specific DOM ID inside a file.
* ~{filename}: Imports the complete structure of the target file layout.

<!-- Location: templates/fragments/common.html -->
<div th:fragment="header-banner(title)">
  <header>
    <h1 th:text="${title}">Generic Page Title</h1>
  </header>
</div>
<!-- Location: templates/index.html --><!-- Uses complete element replacement while passing an explicit context parameter -->
<div th:replace="~{fragments/common :: header-banner(title='Welcome Home')}"></div>

------------------------------
## 8. Element Creation & Removing Markup## Block Element Removal

* th:block: A container tag wrapper that vanishes after template processing. Useful for hosting loop/conditional attributes without adding semantic layout markup wrappers like extra <div> elements.

<th:block th:if="${user.isPremium}">
  <h3>Premium Perk</h3>
  <p>Exclusive downloads inside.</p>
</th:block>

## Structural Pruning (th:remove)
Removes sections of HTML during parsing. Helps maintain clean, viewable preview mockups for UI designers working directly with raw HTML templates.

* all: Deletes the containing tag along with all children.
* body: Deletes children inside the tag but leaves the parent element container.
* tag: Deletes the containing parent element wrapper but preserves its child nodes.
* all-but-first: Deletes all children except the first child node (ideal for mocking table rows).
* none: Leaves the markup untouched.

<table>
  <tr th:each="item : ${items}">
    <td th:text="${item.title}">Real Dynamic Database Item</td>
  </tr>
  <!-- Mock static designer preview rows. Removed at runtime by Thymeleaf -->
  <tr th:remove="all">
    <td>Mock Static Layout Item Preview (Row 2)</td>
  </tr>
  <tr th:remove="all">
    <td>Mock Static Layout Item Preview (Row 3)</td>
  </tr>
</table>

------------------------------
## 9. Expression Utility Objects (Built-ins)
Thymeleaf provides built-in reference helpers prefixed with # to simplify manipulation tasks directly inside the template.
## Basic Framework Helpers

* #ctx: The native execution context.
* #locale: Direct access to the current request locale.
* #vars: Provides access to context variables.

## Strings Context (#strings)

<p th:text="${#strings.toUpperCase(user.name)}"></p>
<p th:if="${#strings.isEmpty(user.middleName)}">No middle name</p>
<p th:text="${#strings.substring(user.bio, 0, 100)} + '...'"></p>
<p th:if="${#strings.contains(user.email, '@gmail.com')}">Google Account</p>

## Numbers Parsing (#numbers)

<!-- Format: integer digits, decimal digits, decimal separator format styling -->
<span th:text="${#numbers.formatDecimal(product.price, 1, 2, 'POINT')}">10.00</span>
<span th:text="${#numbers.formatPercent(taxRate, 1, 2)}">21.00%</span>

## Dates Operations (#dates / #temporals)
Use #dates for legacy java.util.Date objects, or #temporals for Java 8 Time API tracking types (LocalDate, LocalDateTime).

<!-- Formatting Java 8 LocalDate data types -->
<p th:text="${#temporals.format(user.signupDate, 'yyyy-MM-dd HH:mm')}"></p>
<p th:text="${#temporals.dayOfWeekName(user.signupDate)}">Monday</p>

## Collections Evaluation (#lists, #maps, #sets)

<p th:text="${#lists.size(products)}">0</p>
<div th:if="${#lists.isEmpty(products)}">No items available for purchase.</div>
<p th:if="${#maps.containsKey(settingsMap, 'theme')}">Custom layout applied.</p>

------------------------------
## 10. Script Inlining (JavaScript & CSS Contexts)## JavaScript Inlining
Enables parsing variables directly inside dynamic Javascript code blocks using standard script element markers.

<script th:inline="javascript">
    // Thymeleaf reads variable and serializes it safely as an object or literal
    let currentUsername = [[${user.name}]];
    let userRolesArray  = [(${user.rolesJson})]; 

    // Dynamic Javascript comments degrade gracefully inside local development test file checks
    /*[[${user.isAdmin}]]*/ let isAdmin = false; 
    
    if(isAdmin) {
        console.log("Logged in as: " + currentUsername);
    }
</script>

## CSS Inlining
Injects variables safely inside dynamic stylesheets.

<style th:inline="css">
  .profile-banner {
    /*[# th:if="${user.customColor}"]*/
    background-color: [[${user.customColor}]];
    /*[/]*/
    
    /*[# th:unless="${user.customColor}"]*/
    background-color: #f5f5f5;
    /*[/]*/
  }
</style>
