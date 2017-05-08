function escRe(str) {
  return str.replace(/[^\w ]/g, ch => {
    if (ch == "\n") return "\\n"
    if (ch == "\t") return "\\t"
    return "\\" + ch
  })
}

class StringMatch {
  constructor(string) {
    this.string = string
  }

  get isNull() { return false }

  get matchesNewline() { return this.string == "\n" }

  eq(other) { return other instanceof StringMatch && other.string == this.string }

  regexp() { return escRe(this.string) }
}
exports.StringMatch = StringMatch

class RangeMatch {
  constructor(from, to) {
    this.from = from
    this.to = to
  }

  get isNull() { return false }

  get matchesNewline() { return this.from <= "\n" && this.to >= "\n" }

  eq(other) { return other instanceof RangeMatch && other.from == this.from && other.to == this.to }

  regexp() { return "[" + escRe(this.from) + "-" + escRe(this.to) + "]" }
}
exports.RangeMatch = RangeMatch

const anyMatch = exports.anyMatch = new class AnyMatch {
  get isNull() { return false }
  get matchesNewline() { return true }
  eq(other) { return other == anyMatch }
  regexp() { return "." }
}

const nullMatch = exports.nullMatch = new class NullMatch {
  get isNull() { return true }
  get matchesNewline() { return false }
  eq(other) { return other == anyMatch }
  regexp() { return "" }
}

class SeqMatch {
  constructor(matches) {
    this.matches = matches
  }

  get isNull() { return false }

  get matchesNewline() { return false }

  eq(other) { return other instanceof SeqMatch && eqArray(other.matches, this.matches) }

  regexp() { return this.matches.map(m => m.regexp()).join("") }

  static create(left, right) {
    if (left == nullMatch) return right
    if (right == nullMatch) return left
    let matches = []
    if (left instanceof SeqMatch) matches = matches.concat(left.matches)
    else matches.push(left)
    let last = matches[matches.length - 1]
    if (right instanceof StringMatch && last instanceof StringMatch)
      matches[matches.length - 1] = new StringMatch(last.value + right.value)
    else if (right instanceof SeqMatch) matches = matches.concat(right.matches)
    else matches.push(right)
    if (matches.length == 1) return matches[0]
    else return new SeqMatch(matches)
  }
}
exports.SeqMatch = SeqMatch

class ChoiceMatch {
  constructor(matches) {
    this.matches = matches
  }

  get isNull() { return false }

  get matchesNewline() { return false }

  eq(other) { return other instanceof ChoiceMatch && eqArray(other.matches, this.matches) }

  regexp() {
    let set = ""
    for (let i = 0; i < this.matches.length; i++) {
      let match = this.matches[i]
      if (match instanceof StringMatch && match.string.length == 1) {
        set += escRe(match.string)
      } else if (match instanceof RangeMatch) {
        set += escRe(match.from) + "-" + escRe(match.to)
      } else {
        set = null
        break
      }
    }
    if (set != null) return "[" + set + "]"
    return "(?:" + this.matches.map(m => m.regexp()).join("|") + ")"
  }

  static create(left, right) {
    let matches = []
    if (left instanceof ChoiceMatch) matches = matches.concat(left.matches)
    else matches.push(left)
    if (right instanceof ChoiceMatch) matches = matches.concat(right.matches)
    else matches.push(right)
    return new ChoiceMatch(matches)
  }
}
exports.ChoiceMatch = ChoiceMatch

class RepeatMatch {
  constructor(match) {
    this.match = match
  }

  get isNull() { return false }

  get matchesNewline() { return false }

  eq(other) { return other instanceof RepeatMatch && this.match.eq(other.match) }

  regexp() {
    if (this.match instanceof SeqMatch) return "(" + this.match.regexp() + ")*"
    else return this.match.regexp() + "*"
  }
}
exports.RepeatMatch = RepeatMatch

let eqArray = exports.eqArray = function(a, b) {
  if (a.length != b.length) return false
  for (let i = 0; i < a.length; i++) if (!a[i].eq(b[i])) return false
  return true
}