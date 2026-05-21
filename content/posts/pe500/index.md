---
title: "Project Euler Problem #500"
date: 2026-05-20
draft: false
summary: My solution to problem \#500 from Project Euler
tags: ["Math", "Project Euler"]
---
{{< katex >}}

Whenever I remember [Project Euler](https://projecteuler.net/) exists, I become obsessed with it for a week, and then forget about it for another year. Something reminded me of PE recently, so this week is one of those weeks.

I was spoiled for choice with the project's archive of nearly 1000 problems, but eventually settled on [problem #500](https://projecteuler.net/problem=500). It appealed to me because it's short and sweet:

> The number of divisors of \(120\) is \(16\).
> In fact \(120\) is the smallest number having \(16\) divisors.
>
> Find the smallest number with \(2^{500500}\) divisors.
> Give your answer modulo \(500500507\).

I want to share the analytical part of my solution, becuase I find it mathematically satisfying. However, I will not be posting the computation code or the final answer to avoid ruining the fun for others.

# Solution

Let \(N\) be a number with prime factorization \(q_1^{a_1} \cdot q_2^{a_2} \dots  q_k^{a_k}\), where \(q_i\) is a uinque prime. \(N\) has \(n\) divisors given by

$$
\begin{align}
n &= (a_1+1)(a_2+1)\dots (a_k+1) = p_1 \cdot p_2 \dots  p_m
\end{align}
$$

where \(p_i\) is a prime factor of \(n\) and \(k \le m\). For \(N\) to be the *smallest* number with \(n\) divisors, it must have

- \(k=m\)
- \(q_1 < q_2 < \dots < q_k\)
- \(a_1 \ge a_2 \ge \dots \ge a_k\)

The sequence of primes \(q_i\) is known, so our goal is to determine the sequence of exponents \(a_i\). We can combine the prime factors \(p_i\) in equation (1) into exactly \(k\) factors \(\bar{p}_i\) 

$$
(a_1+1)(a_2+1)\dots (a_k+1) = \underbrace{(p_1 \dots p_{x})}_{\bar{p}_{1}}\dots \underbrace{(p_{y}\dots p_{z})}_{\bar{p}_i}\cdot \underbrace{p_{z+1}}_{\bar{p}_{i+1}}\dots \underbrace{p_m}_{\bar{p}_k}
$$

which yields \(a_i = \bar{p}_i-1\). Of course, if \(k = m\) then \(\bar{p}_i = p_i\).

We are given \(n = 2^{500500}\), so:
- \(p_i = 2, \  \forall \ i\) 
- \(m = 500500\)

Let's assume \(k = m\). Then \(q_k = q_{500500} = 7376507\) and

$$
N = q_1^{(p_1-1)}\cdot q_2^{(p_2-1)}\dots q_k^{(p_k-1)} = q_1^{(2-1)}\cdot q_2^{(2-1)}\dots q_k^{(2-1)} = 2\cdot 3 \cdot 5 \dots 7376507
$$

is the smallest number with \(n\) divisors. However, if we combine \(p_1\) and \(p_2\) into \(\bar{p}_1 = 4\)

$$
\begin{align}
n &= 2\cdot 2\cdot 2 \dots 2 = 2^2 \cdot 2 \dots 2 \\
N &= 2^{(2^2 - 1)} \cdot 3 \cdot 5 \dots q_{k-1} = (2 \cdot 2^2) \cdot 3 \cdot 5 \dots q_{k-1} \\
\end{align}
$$

the value of \(N\) decreased by \(\frac{2^2}{q_k}\) which is a substantial, because \(2^2 \ll q_k\). Since we can make \(N\) smaller, our assumption that \(k = m\) was wrong, and actually \(k \le m\).

Suppose we "upgrade" the first prime two more times:

$$
\begin{align}
n &= 2^2 \cdot 2 \cdot 2 \dots 2 = 2^3 \cdot 2 \dots 2 \\
N &= 2^{(2^3 - 1)}\cdot 3 \cdot 5 \dots q_{k-2} = (2^3 \cdot 2^4) \cdot 3 \cdot 5 \dots q_{k-2}\\ 
n &= 2^3 \cdot 2 \cdot 2 \dots 2 = 2^4 \cdot 2 \dots 2 \\
N &= 2^{(2^4 - 1)}\cdot  3 \cdot 5 \dots q_{k-3} = (2^7 \cdot 2^8) \cdot 3 \cdot 5 \dots q_{k-3}
\end{align}
$$

Notice how the cost of each upgrade \(j\) is \(q_i^{2^{j-1}}\) and the savings are \(q_{\text{current last}}\). An upgrade is only viable when the cost is strictly less than the savings, so problem then boils down to finding the maximum possible \(j\) for every prime \(q_i\). For example, the maximum \(j\) for \(q_1 = 2\) is \(5\), because

$$
\begin{align}
2^{2^4} &= 65536 <7376507\\
2^{2^5} &= 4294967296 > 7376507\\
\end{align}
$$

By upgrading \(q_1\) four times we "shaved off" four large primes from the end of the \(N\) product. 

We repeat the same process for the remaining primes to determine the maximum number of upgrades for each one. As a result, we find that the smallest number \(N\) with \(n=2^{500500}\) divisors is

$$
N = 2^{(2^5 - 1)}\cdot (3 \cdot 5 \cdot 7)^{(2^4-1)} \cdot (11 \dots 47)^{(2^3-1)} \cdot (53\dots 2713)^{(2^2-1)}\cdot 2719 \dots q_{k-416}
$$

The prime factor upgrades minimized \(N\) by removing 416 large primes from the end of the product. All that's left is to write an efficient program to compute the value of \(N\).

