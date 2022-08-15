@preprocessor typescript

@{%
const lexer: any = {has: () => true};
%}

@lexer lexer

# Whole document
doc -> sta %nl doc | %nl doc | sta %nl | sta | %nl
# Assignment statement
sta -> rec %eq exp
# If-expression and if-receiver
ife -> "if" exp "then" exp "else" exp "endif"
ifr -> "if" exp "then" rec "else" rec "endif"

# General expression
exp -> exp2 | fnd
# Function definition expression
fnd -> vrl %rt exp
# Compound expressions with binary operators
exp2 -> exp2 op2 exp1 mc2 | exp1 mc2
exp1 -> exp1 op1 exp0 mc1 | exp0 mc1
exp0 -> exp0 op0 vcf  mc0 | vcf mc0

# Maybe whitespace
mws -> ws | null
ws -> %os | %ms
# Maybe (semi)colon
mc2 -> %ms ";" | null
mc1 -> %os ";" | null
mc0 -> ";" | null
# Binary operators
op2 -> %ms %op mws | %os %op %ms | %op %ms
op1 -> %os %op | %op %os | %os %op %os
op0 -> %op
# Variable list
vrl -> vrl ws %vr | %vr | null
# Variable / constant / if: primitive expressions
vcf -> %vr | %cnst | ife
# Receivers: the complement to expressions
rec -> %vr | ifr

