# E0 Equation Language & Interval Solver

**Live Playground:** [aleksandr-shibaev.github.io/web-smt-solver](https://aleksandr-shibaev.github.io/web-smt-solver)

A declarative constraint language and interactive browser playground for solving systems of arithmetic, bitwise, and logical equations. Instead of writing step-by-step imperative instructions, you define the mathematical conditions that unknown variables must satisfy, and the solver searches for valid values directly in your browser using **interval arithmetic** and **backtracking search**.

> **Note:** This project was created exclusively for educational purposes as a playground for exploring interval constraint propagation, SMT-style modeling, and combinatorial optimization.

## How It Works

1. **Fixed-Width Representation:** Numbers are modeled as fixed-width two's complement (or unsigned) binary vectors configured via `size <int> <frac>` (or `size + <int> <frac>` for non-negative values).
2. **Interval Propagation:** Arithmetic, relational, and conditional constraints are evaluated over numeric bounds to narrow down feasible variable domains before and during branching.
3. **Backtracking Search & Optimization:** Boolean decisions, bit-level splits, and `binarySearch min/max` directives run locally inside a background **Web Worker** with zero server setup.

## Quick Example

```e0
// Integer factorization
a * b = 77

a > 1
b > 1

// 8-bit signed integer, 0 fractional bits
size 8 0
```


## Web Playground

Run the interactive editor, visual problem generators, and documentation locally:

```bash
npm install
npm run dev
```

## Documentation

* **[Language Specification](docs/language-spec.md)** — data types, operators, bit access, optimization rules, and configuration directives.
* **[Examples](docs/examples.md)** — collection of constraint problems and algorithms.

## License

This project is open-source software licensed under the **MIT License** (see [`LICENSE`](LICENSE)).
