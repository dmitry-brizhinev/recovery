@preprocessor typescript
@{% const lexer: any = {has: () => true}; %}
@lexer lexer
 
# Whole document
doc -> mnl blo mnl                                            #doc:fu
mnl -> mnl mws %nl | null                                     #mnl:d
wnl -> ws | mnl mws %nl mws                                   #wnl:d
# Statements
ass -> rec %eq exp                                            #ass:fl
ret -> "return" ws exp                                        #ret:fl
brk -> "break"                                                #brk:fl
cnt -> "continue"                                             #cnt:fl
bls -> ife | dow | wdo | for | doo                            #bls:fu
sta -> ass | ret | brk | cnt | exp                            #sta:fu
sep -> mnl mws %nl mws                                        #sep:d
# Receivers: the complement to expressions
rec -> var | exp %dt %vr | %nu                                #rec:fm

# If-statement and If-expression
eob -> wnl blo wnl                                            #eob:fu
blo -> blo sep sta | sta                                      #blo:ff
#ifs -> ife
ife -> "if" ifb ifn ifl "endif"                               #ife:fl
ifl -> null | "else" eob                                      #ifl:fu
ifn -> null | "elif" ifb ifn                                  #ifn:ff
ifb -> ws exp ws "then" eob                                   #ifb:fl
dow -> "do" eob "while" ws exp ws "end"                       #dow:fl
wdo -> "while" ws exp ws "do" eob "end"                       #wdo:fl
for -> "for" ws var ws "in" ws exp ws "do" eob "end"          #for:fl
doo -> "do" eob "end"                                         #doo:fl
# General expression
exp -> exa2 | fnd                                             #exp:fu
# Function definition expression
eod -> exp                                                    #eod:fu
fnd -> vrl %rt typ ws eod | vrl %rt eod | vrl %rt "struct" ws %tc #fnd:fl
# Compound expressions with binary operators
exa2 -> exc2                                                  #exa2:fu
#arr2 -> ars2 %ms "]"
exc2 -> exl2 sc2      | exl2                                  #exc2:fm
exl2 -> exl2 cl2 emo2 | emo2                                  #exl2:fm
emo2 -> exo2 | exm2 | ars2 %ms "]"                            #emo2:fu
ars2 -> ars2 cm2 exo2 | "[" %ms exo2                          #ars2:fl
exm2 -> exm2 cm2 exo2 | cm2 exo2                              #exm2:fm
exo2 -> exo2 op2 exa1 | exa1                                  #exo2:fm
# One space
exa1 -> exc1                                                  #exa1:fu
#arr1 -> ars1 %os "]"
exc1 -> exl1 sc1      | exl1                                  #exc1:fm
exl1 -> exl1 cl1 emo1 | emo1                                  #exl1:fm
emo1 -> exo1 | exm1 | ars1 %os "]"                            #emo1:fu
ars1 -> ars1 cm1 exo1 | "[" %os exo1                          #ars1:fl
exm1 -> exm1 cm1 exo1 | cm1 exo1                              #exm1:fm
exo1 -> exo1 op1 exa0 | exa0                                  #exo1:fm
# No spaces
exa0 -> exc0                                                  #exa0:fu
#arr0 -> ars0 "]"
exc0 -> exl0 sc0      | exl0                                  #exc0:fm
exl0 -> exl0 cl0 emo0 | emo0                                  #exl0:fm
emo0 -> exo0 | exm0 | ars0 "]"                                #emo0:fu
ars0 -> ars0 cm0 exo0 | "[" exo0                              #ars0:fl
exm0 -> exm0 cm0 exo0 | cm0 exo0                              #exm0:fm
exo0 -> exo0 op0 dot  | dot                                   #exo0:fm
# Dot operator
dot -> vcf | vcf %dt %vr                                      #dot:fm
# Variable / constant / if: primitive expressions
vcf -> %vr | %cnst | %nu | bls | "(" mws exp mws ")" | arre   #vcf:fu
arre -> "[" mws "]"                                           #arre:fl

# Maybe whitespace
mws -> ws | null                                              #mws:d
ws -> %os | %ms                                               #ws:d
# Semicolon
sc2 -> %ms %sc                                                #sc2:fu
sc1 -> %os %sc                                                #sc1:fu
sc0 -> %sc                                                    #sc0:fu
# Binary operators
op2 -> %ms %op mws | %os %op %ms | %op %ms                    #op2:fu
op1 -> %os %op | %op %os | %os %op %os                        #op1:fu
op0 -> %op                                                    #op0:fu
# Comma
cm2 -> %ms %cm mws | %os %cm %ms | %cm %ms                    #cm2:fu
cm1 -> %os %cm | %cm %os | %os %cm %os                        #cm1:fu
cm0 -> %cm                                                    #cm0:fu
# Colon / double-colon
cl2 -> %ms %cl mws | %os %cl %ms | %cl %ms                    #cl2:fu
cl1 -> %os %cl | %cl %os | %os %cl %os                        #cl1:fu
cl0 -> %cl                                                    #cl0:fu
# Type annotations
typ -> "{" ftp "}" | "{" ttp "}" | "[" atp "]" | %tc | %tp | mtp #typ:fu
mtp -> typ %qm                                                #mtp:fl
ttp -> %cm typ | ttp %cm typ                                  #ttp:fl
atp -> typ                                                    #atp:fl
ftp -> %rt typ | tps %rt typ                                  #ftp:fl
tps -> typ | tps ":" typ                                      #tps:ff
# Variable with type annotation
var -> %vr | %vr mws typ                                      #var:fl
# Variable list
vrl -> vrl ws var | var | null                                #vrl:ff
