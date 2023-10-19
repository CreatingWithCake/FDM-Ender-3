#!/usr/bin/env node

//
// Formatter script for pins_MYPINS.h files
//
// Usage: mffmt [infile] [outfile]
//
// With no parameters convert STDIN to STDOUT
//

const fs = require("fs");

// String lpad / rpad
String.prototype.lpad = function(len, chr) {
  if (!len) return this;
  if (chr === undefined) chr = ' ';
  var s = this+'', need = len - s.length;
  if (need > 0) s = new Array(need+1).join(chr) + s;
  return s;
};

String.prototype.rpad = function(len, chr) {
  if (!len) return this;
  if (chr === undefined) chr = ' ';
  var s = this+'', need = len - s.length;
  if (need > 0) s += new Array(need+1).join(chr);
  return s;
};

const mpatt = [ '-?\\d{1,3}', 'P[A-I]\\d+', 'P\\d_\\d+', 'Pin[A-Z]\\d\\b' ],
      definePatt = new RegExp(`^\\s*(//)?#define\\s+[A-Z_][A-Z0-9_]+\\s+(${mpatt[0]}|${mpatt[1]}|${mpatt[2]}|${mpatt[3]})\\s*(//.*)?$`, 'gm'),
      ppad = [ 3, 4, 5, 5 ],
      col_comment = 50,
      col_value_rj = col_comment - 3;

var mexpr = [];
for (let m of mpatt) mexpr.push(new RegExp('^' + m + '$'));

const argv = process.argv.slice(2), argc = argv.length;

var src_file = 0, src_name = 'STDIN', dst_file, do_log = false;
if (argc > 0) {
  let ind = 0;
  if (argv[0] == '-v') { do_log = true; ind++; }
  dst_file = src_file = src_name = argv[ind++];
  if (ind < argc) dst_file = argv[ind];
}

// Read from file or STDIN until it terminates
const filtered = process_text(fs.readFileSync(src_file).toString());
if (dst_file)
  fs.writeFileSync(dst_file, filtered);
else
  console.log(filtered);

// Find the pin pattern so non-pin defines can be skipped
function get_pin_pattern(txt) {
  var r, m = 0, match_count = [ 0, 0, 0, 0 ];
  definePatt.lastIndex = 0;
  while ((r = definePatt.exec(txt)) !== null) {
    let ind = -1;
    if (mexpr.some((p) => {
      ind++;
      const didmatch = r[2].match(p);
      return r[2].match(p);
    }) ) {
      const m = ++match_count[ind];
      if (m >= 5) {
        return { match: mpatt[ind], pad:ppad[ind] };
      }
    }
  }
  return null;
}

function process_text(txt) {
  if (!txt.length) return '(no text)';
  const patt = get_pin_pattern(txt);
  if (!patt) return txt;
  const pindefPatt = new RegExp(`^(\\s*(//)?#define)\\s+([A-Z_][A-Z0-9_]+)\\s+(${patt.match})\\s*(//.*)?$`),
         noPinPatt = new RegExp(`^(\\s*(//)?#define)\\s+([A-Z_][A-Z0-9_]+)\\s+(-1)\\s*(//.*)?$`),
         skipPatt1 = new RegExp('^(\\s*(//)?#define)\\s+(AT90USB|USBCON|(BOARD|DAC|FLASH|HAS|IS|USE)_.+|.+_(ADDRESS|AVAILABLE|BAUDRATE|CLOCK|CONNECTION|DEFAULT|FREQ|ITEM|MODULE|NAME|ONLY|PERIOD|RANGE|RATE|SERIAL|SIZE|SPI|STATE|STEP|TIMER))\\s+(.+)\\s*(//.*)?$'),
         skipPatt2 = new RegExp('^(\\s*(//)?#define)\\s+([A-Z_][A-Z0-9_]+)\\s+(0x[0-9A-Fa-f]+|\d+|.+[a-z].+)\\s*(//.*)?$'),
         aliasPatt = new RegExp('^(\\s*(//)?#define)\\s+([A-Z_][A-Z0-9_]+)\\s+([A-Z_][A-Z0-9_()]+)\\s*(//.*)?$'),
        switchPatt = new RegExp('^(\\s*(//)?#define)\\s+([A-Z_][A-Z0-9_]+)\\s*(//.*)?$'),
         undefPatt = new RegExp('^(\\s*(//)?#undef)\\s+([A-Z_][A-Z0-9_]+)\\s*(//.*)?$'),
           defPatt = new RegExp('^(\\s*(//)?#define)\\s+([A-Z_][A-Z0-9_]+)\\s+([-_\\w]+)\\s*(//.*)?$'),
          condPatt = new RegExp('^(\\s*(//)?#(if|ifn?def|else|elif)(\\s+\\S+)*)\\s+(//.*)$'),
          commPatt = new RegExp('^\\s{20,}(//.*)?$');
  const col_value_lj = col_comment - patt.pad - 2;
  var r, out = '', check_comment_next = false;
  txt.split('\n').forEach((line) => {
    if (check_comment_next)
      check_comment_next = ((r = commPatt.exec(line)) !== null);

    if (check_comment_next)
      // Comments in column 45
      line = ''.rpad(col_comment) + r[1];

    else if (skipPatt1.exec(line) !== null) {
      //
      // #define SKIP_ME
      //
      if (do_log) console.log("skip:", line);
    }
    else if ((r = pindefPatt.exec(line)) !== null) {
      //
      // #define MY_PIN [pin]
      //
      if (do_log) console.log("pin:", line);
      const pinnum = r[4].charAt(0) == 'P' ? r[4] : r[4].lpad(patt.pad);
      line = r[1] + ' ' + r[3];
      line = line.rpad(col_value_lj) + pinnum;
      if (r[5]) line = line.rpad(col_comment) + r[5];
    }
    else if ((r = noPinPatt.exec(line)) !== null) {
      //
      // #define MY_PIN -1
      //
      if (do_log) console.log("pin -1:", line);
      line = r[1] + ' ' + r[3];
      line = line.rpad(col_value_lj) + '-1';
      if (r[5]) line = line.rpad(col_comment) + r[5];
    }
    else if (skipPatt2.exec(line) !== null) {
      //
      // #define SKIP_ME
      //
      if (do_log) console.log("skip:", line);
    }
    else if ((r = aliasPatt.exec(line)) !== null) {
      //
      // #define ALIAS OTHER
      //
      if (do_log) console.log("alias:", line);
      line = r[1] + ' ' + r[3];
      line += r[4].lpad(col_value_rj + 1 - line.length);
      if (r[5]) line = line.rpad(col_comment) + r[5];
    }
    else if ((r = switchPatt.exec(line)) !== null) {
      //
      // #define SWITCH
      //
      if (do_log) console.log("switch:", line);
      line = r[1] + ' ' + r[3];
      if (r[4]) line = line.rpad(col_comment) + r[4];
      check_comment_next = true;
    }
    else if ((r = defPatt.exec(line)) !== null) {
      //
      // #define ...
      //
      if (do_log) console.log("def:", line);
      line = r[1] + ' ' + r[3] + ' ';
      line += r[4].lpad(col_value_rj + 1 - line.length);
      if (r[5]) line = line.rpad(col_comment - 1) + ' ' + r[5];
    }
    else if ((r = undefPatt.exec(line)) !== null) {
      //
      // #undef ...
      //
      if (do_log) console.log("undef:", line);
      line = r[1] + ' ' + r[3];
      if (r[4]) line = line.rpad(col_comment) + r[4];
    }
    else if ((r = condPatt.exec(line)) !== null) {
      //
      // #if ...
      //
      if (do_log) console.log("cond:", line);
      line = r[1].rpad(col_comment) + r[5];
      check_comment_next = true;
    }
    out += line + '\n';
  });
  return out.replace(/\n\n+/g, '\n\n').replace(/\n\n$/g, '\n');
}
