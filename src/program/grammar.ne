@preprocessor typescript
@{% const lexer: any = {has: () => true}; %}
@lexer lexer

# Whole document
doc -> sta %nl doc | %nl doc | sta %nl | sta | %nl
# Assignment statement
sta -> rec %eq exp
# Receivers: the complement to expressions
rec -> var | exp %dt %vr

# If-expression
ife -> ifs ifn
ifn -> "endif" | "else" exp "endif" | "elif" exp "then" exp ifn
ifs -> "if" exp "then" exp
# General expression
exp -> exa2 | fnd
# Function definition expression
fnd -> vrl %rt typ ws exp | vrl %rt exp | vrl %rt "struct" %tc
# Compound expressions with binary operators
exa2 -> exc2 #| arr2
#arr2 -> ars2 %ms "]"
exc2 -> exl2 sc2      | exl2
exl2 -> exl2 cl2 emo2 | emo2
emo2 -> exo2 | exm2 | ars2 %ms "]"
ars2 -> ars2 cm2 exo2 | "[" %ms exo2
exm2 -> exm2 cm2 exo2 | cm2 exo2
exo2 -> exo2 op2 exa1 | exa1
# One space
exa1 -> exc1 #| arr1
#arr1 -> ars1 %os "]"
exc1 -> exl1 sc1      | exl1
exl1 -> exl1 cl1 emo1 | emo1
emo1 -> exo1 | exm1 | ars1 %os "]"
ars1 -> ars1 cm1 exo1 | "[" %os exo1
exm1 -> exm1 cm1 exo1 | cm1 exo1
exo1 -> exo1 op1 exa0 | exa0
# No spaces
exa0 -> exc0 #| arr0
#arr0 -> ars0 "]"
exc0 -> exl0 sc0      | exl0
exl0 -> exl0 cl0 emo0 | emo0
emo0 -> exo0 | exm0 | ars0 "]"
ars0 -> ars0 cm0 exo0 | "[" exo0
exm0 -> exm0 cm0 exo0 | cm0 exo0
exo0 -> exo0 op0 dot  | dot
# Dot operator
dot -> vcf | vcf %dt %vr
# Variable / constant / if: primitive expressions
vcf -> %vr | %cnst | ife | "(" mws exp mws ")" | arre
arre -> "[" mws "]"

# Maybe whitespace
mws -> ws | null
ws -> %os | %ms
# Semicolon
sc2 -> %ms %sc
sc1 -> %os %sc
sc0 -> %sc
# Binary operators
op2 -> %ms %op mws | %os %op %ms | %op %ms
op1 -> %os %op | %op %os | %os %op %os
op0 -> %op
# Comma
cm2 -> %ms %cm mws | %os %cm %ms | %cm %ms
cm1 -> %os %cm | %cm %os | %os %cm %os
cm0 -> %cm
# Colon / double-colon
cl2 -> %ms %cl mws | %os %cl %ms | %cl %ms
cl1 -> %os %cl | %cl %os | %os %cl %os
cl0 -> %cl
# Type annotations
typ -> "{" ctp "}" | %tc | %tp
ctp -> ftp | ttp | atp
ttp -> %cm typ | ttp %cm typ
atp -> "a" typ
ftp -> %rt typ | tps %rt typ
tps -> typ | tps ":" typ
# Variable with type annotation
var -> %vr | %vr mws typ
# Variable list
vrl -> vrl ws var | var | null
