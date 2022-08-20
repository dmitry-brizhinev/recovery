@preprocessor typescript
@{% const lexer: any = {has: () => true}; %}
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
fnd -> vrl %rt typ ws exp | vrl %rt exp | vrl %rt "struct" %tc
# Compound expressions with binary operators
exp2 -> exp2 op2 exp1 mc2 | exp1 mc2
exp1 -> exp1 op1 exp0 mc1 | exp0 mc1
exp0 -> exp0 op0 vcf mc0 | vcf mc0

# Maybe whitespace
mws -> ws | null
ws -> %os | %ms
# Maybe (semi)colon
mc2 -> %ms %sc | null
mc1 -> %os %sc | null
mc0 -> %sc | null
# Binary operators
op2 -> %ms %op mws | %os %op %ms | %op %ms
op1 -> %os %op | %op %os | %os %op %os
op0 -> %op
# Type annotations
typ -> "{" ctp "}" | %tc | %tp
ctp -> ftp | ttp | atp
ttp -> typ "," | ttp typ ","
atp -> "a" typ
ftp -> %rt typ | tps %rt typ
tps -> typ | tps ":" typ
# Variable with type annotation
var -> %vr | %vr mws typ
# Variable list
vrl -> vrl ws var | var | null
# Variable / constant / if: primitive expressions
vcf -> %vr | %cnst | ife
# Receivers: the complement to expressions
rec -> var | ifr | %vr mws "." mws %vr
