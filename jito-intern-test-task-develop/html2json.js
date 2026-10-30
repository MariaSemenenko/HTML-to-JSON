(function (root) {
  "use strict";

  var VOID_TAGS = Object.create(null);
  "area base br col embed hr img input link meta param source track wbr"
    .split(" ")
    .forEach(function (tag) {
      VOID_TAGS[tag] = true;
    });
  var RAW_TEXT_TAGS = Object.create(null);
  "script style".split(" ").forEach(function (tag) {
    RAW_TEXT_TAGS[tag] = true;
  });
  var RCDATA_TAGS = Object.create(null);
  "textarea title".split(" ").forEach(function (tag) {
    RCDATA_TAGS[tag] = true;
  });
  
  var P_CLOSING_TAGS = Object.create(null);
  "address article aside blockquote div dl fieldset footer form h1 h2 h3 h4 h5 h6 header hr main nav ol p pre section table ul"
    .split(" ")
    .forEach(function (tag) {
      P_CLOSING_TAGS[tag] = true;
    });

  var namedEntities = Object.assign(Object.create(null), {
    amp: { characters: "&" }, "amp;": { characters: "&" },
    lt: { characters: "<" }, "lt;": { characters: "<" },
    gt: { characters: ">" }, "gt;": { characters: ">" },
    quot: { characters: '"' }, "quot;": { characters: '"' },
    apos: { characters: "'" }, "apos;": { characters: "'" },
    nbsp: { characters: " " }, "nbsp;": { characters: " " },
    copy: { characters: "©" }, "copy;": { characters: "©" },
    reg: { characters: "®" }, "reg;": { characters: "®" },
    euro: { characters: "€" }, "euro;": { characters: "€" },
    hearts: { characters: "♥" }, "hearts;": { characters: "♥" },
    pound: { characters: "£" }, "pound;": { characters: "£" },
    yen: { characters: "¥" }, "yen;": { characters: "¥" },
    cent: { characters: "¢" }, "cent;": { characters: "¢" },
    alpha: { characters: "α" }, "alpha;": { characters: "α" },
    beta: { characters: "β" }, "beta;": { characters: "β" },
    times: { characters: "×" }, "times;": { characters: "×" },
    divide: { characters: "÷" }, "divide;": { characters: "÷" }
  });
  var namedEntityPattern;

  function rebuildNamedEntityPattern() {
    var names = Object.keys(namedEntities).filter(function (name) {
      return /^[A-Za-z0-9]+;?$/.test(name);
    }).sort(function (a, b) { return b.length - a.length; });
    namedEntityPattern = new RegExp("&(#(?:[xX][0-9a-fA-F]+|[0-9]+);?|" + names.join("|") + ")", "g");
  }

  rebuildNamedEntityPattern();

  var entitiesReady = typeof fetch === "function"
    ? fetch("https://html.spec.whatwg.org/entities.json")
        .then(function (response) {
          if (!response.ok) throw new Error("Entity dictionary request failed");
          return response.json();
        })
        .then(function (data) {
          if (!data || typeof data !== "object") throw new Error("Invalid entity dictionary");
          Object.keys(data).forEach(function (sourceName) {
            var name = sourceName.charAt(0) === "&" ? sourceName.slice(1) : sourceName;
            var entry = data[sourceName];
            if (/^[A-Za-z0-9]+;?$/.test(name) && entry && typeof entry.characters === "string") {
              namedEntities[name] = { characters: entry.characters };
            }
          });
          rebuildNamedEntityPattern();
        })
        .catch(function () { /* Keep the built-in common-entity fallback. */ })
    : Promise.resolve();

  function decodeEntities(value) {
    return value.replace(namedEntityPattern, function (whole, entity) {
      if (entity.charAt(0) !== "#") {
        var named = namedEntities[entity];
        return named ? named.characters : whole;
      }
      var hex = entity.charAt(1).toLowerCase() === "x";
      var number = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!isFinite(number) || number <= 0 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) return "�";
      try { return String.fromCodePoint(number); } catch (_) { return "�"; }
    });
  }
  function parseAttributes(source) {
    var attributes = Object.create(null);
    var i = 0;
    while (i < source.length) {
      while (/\s/.test(source.charAt(i))) i++;
      if (i >= source.length || source.charAt(i) === "/") break;
      var start = i;
      while (i < source.length && !/[\s=/>]/.test(source.charAt(i))) i++;
      if (start === i) {
        i++;
        continue;
      }
      var name = source.slice(start, i).toLowerCase();
      while (/\s/.test(source.charAt(i))) i++;
      var value = "";
      if (source.charAt(i) === "=") {
        i++;
        while (/\s/.test(source.charAt(i))) i++;
        var quote = source.charAt(i);
        if (quote === '"' || quote === "'") {
          i++;
          start = i;
          while (i < source.length && source.charAt(i) !== quote) i++;
          value = source.slice(start, i);
          if (source.charAt(i) === quote) i++;
        } else {
          start = i;
          while (i < source.length && !/[\s>]/.test(source.charAt(i))) i++;
          value = source.slice(start, i).replace(/\/$/, function (slash) {
            return slash;
          });
        }
      }
      if (!Object.prototype.hasOwnProperty.call(attributes, name))
        attributes[name] = decodeEntities(value);
    }
    return attributes;
  }

  function html2json(htmlText) {
    var input =
      typeof htmlText === "string"
        ? htmlText
        : htmlText == null
          ? ""
          : String(htmlText);
    var rootNode = { tag: "#document", attributes: {}, children: [] };
    var stack = [rootNode];
    var position = 0;

    function appendText(text, decode) {
      if (!text) return;
      var content = decode ? decodeEntities(text) : text;
      var children = stack[stack.length - 1].children;
      if (
        children.length &&
        Object.prototype.hasOwnProperty.call(
          children[children.length - 1],
          "text",
        )
      ) {
        children[children.length - 1].text += content;
      } else children.push({ text: content });
    }

    while (position < input.length) {
      var parent = stack[stack.length - 1];
      if (RAW_TEXT_TAGS[parent.tag] || RCDATA_TAGS[parent.tag]) {
        var closing = new RegExp("</\\s*" + parent.tag + "\\s*>", "ig");
        closing.lastIndex = position;
        var closeMatch = closing.exec(input);
        if (!closeMatch) {
          appendText(input.slice(position), RCDATA_TAGS[parent.tag]);
          break;
        }
        appendText(
          input.slice(position, closeMatch.index),
          RCDATA_TAGS[parent.tag],
        );
        position = closing.lastIndex;
        stack.pop();
        continue;
      }

      if (input.charAt(position) !== "<") {
        var nextTag = input.indexOf("<", position);
        if (nextTag < 0) nextTag = input.length;
        appendText(input.slice(position, nextTag), true);
        position = nextTag;
        continue;
      }
      if (input.slice(position, position + 4) === "<!--") {
        var commentEnd = input.indexOf("-->", position + 4);
        var commentText =
          commentEnd < 0
            ? input.slice(position + 4)
            : input.slice(position + 4, commentEnd);
        stack[stack.length - 1].children.push({ comment: commentText });
        position = commentEnd < 0 ? input.length : commentEnd + 3;
        continue;
      }
      if (/^<!doctype\b/i.test(input.slice(position))) {
        var doctypeEnd = input.indexOf(">", position + 2);
        position = doctypeEnd < 0 ? input.length : doctypeEnd + 1;
        continue;
      }
      if (input.slice(position, position + 2) === "</") {
        var endTag = /^<\/\s*([a-z][\w:-]*)[^>]*>/i.exec(input.slice(position));
        if (!endTag) {
          appendText("<", true);
          position++;
          continue;
        }
        var closingName = endTag[1].toLowerCase();
        for (var s = stack.length - 1; s > 0; s--) {
          if (stack[s].tag === closingName) {
            stack.length = s;
            break;
          }
        }
        position += endTag[0].length;
        continue;
      }

      var tagStart = /^<([a-z][\w:-]*)\b/i.exec(input.slice(position));
      if (!tagStart) {
        appendText("<", true);
        position++;
        continue;
      }
      autoCloseForStartTag(stack, tagStart[1].toLowerCase());
      var cursor = position + tagStart[0].length;
      var quoteChar = "";
      while (cursor < input.length) {
        var character = input.charAt(cursor);
        if (quoteChar) {
          if (character === quoteChar) quoteChar = "";
        } else if (character === '"' || character === "'")
          quoteChar = character;
        else if (character === ">") break;
        cursor++;
      }
      var complete = cursor < input.length;
      var rawTag = input.slice(
        position + 1 + tagStart[1].length,
        complete ? cursor : input.length,
      );
      var element = {
        tag: tagStart[1].toLowerCase(),
        attributes: parseAttributes(rawTag),
        children: [],
      };
      stack[stack.length - 1].children.push(element);
      var selfClosing = /\/\s*$/.test(rawTag);
      position = complete ? cursor + 1 : input.length;
      if (!selfClosing && !VOID_TAGS[element.tag]) stack.push(element);
    }
    return rootNode;
  }

  async function convertHtml2JsonAndSet() {
  var input = document.getElementById("html");
  var output = document.getElementById("json");

  try {
  
    await entitiesReady;

    output.value = JSON.stringify(
      html2json(input.value),
      null,
      2
    );

  } catch (error) {

    output.value = JSON.stringify({
      error: String(error.message || error)
    }, null, 2);
  }
}

  function loadExample(html) {
    var input = document.getElementById("html");
    var output = document.getElementById("json");
    if (!input || !output) return;
    input.value = html;
    output.value = JSON.stringify(
      {
        "Comment 1":
          "You have to think about how to take into account various html inputs so your json structure will cover them all and handle different cases.",
        "Comment 2":
          "When you make any choice in terms of selecting specific json structure for conversion - be ready to provide reasoning behind such choice.",
      },
      null,
      2,
    );
  }

  function showExample1() {
    loadExample(
      '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Sample HTML</title>\n</head>\n<body>\n  <header><h1>Welcome to My Website</h1></header>\n  <nav><ul><li><a href="#home">Home</a></li><li><a href="#about">About</a></li><li><a href="#contact">Contact</a></li></ul></nav>\n  <main><section id="home"><h2>Home Section</h2><p>This is the home section of the webpage.</p></section><section id="about"><h2>About Section</h2><p>This is the about section of the webpage.</p></section></main>\n  <footer><p>&copy; 2024 My Website</p></footer>\n</body>\n</html>',
    );
  }

  function showExample2() {
    loadExample(
      "<div>\n  <p>Hello world!</p>\n  <button>Click me!</button>\n  <textarea>Some very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long string.</textarea>\n</div>",
    );
  }

  function closeNearest(stack, openTags, stopTags) {
    for (var s = stack.length - 1; s > 0; s--) {
      var currentTag = stack[s].tag;
      if (openTags[currentTag]) {
        stack.length = s;
        return true;
      }
      if (stopTags && stopTags[currentTag]) {
        return false;
      }
    }
    return false;
  }

  function ensureTableRow(stack) {
    for (var s = stack.length - 1; s > 0; s--) {
      if (stack[s].tag === "tr") return;
      if (stack[s].tag === "table") {
        var row = { tag: "tr", attributes: {}, children: [] };
        stack[stack.length - 1].children.push(row);
        stack.push(row);
        return;
      }
    }
  }

  function autoCloseForStartTag(stack, tag) {
    if (tag === "li")
      closeNearest(stack, { li: true }, { ul: true, ol: true, menu: true });
    if (P_CLOSING_TAGS[tag]) closeNearest(stack, { p: true });
    if (tag === "tr") {
      closeNearest(stack, { td: true, th: true }, { tr: true, table: true });
      closeNearest(stack, { tr: true }, { table: true });
    }
    if (tag === "td" || tag === "th") {
      closeNearest(stack, { td: true, th: true }, { tr: true, table: true });
      ensureTableRow(stack);
    }
  }
  root.html2json = html2json;
  root.convertHtml2JsonAndSet = convertHtml2JsonAndSet;
  root.showExample1 = showExample1;
  root.showExample2 = showExample2;
})(typeof window !== "undefined" ? window : globalThis);



