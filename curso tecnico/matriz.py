import random as rd


m = []


for l in range(6):
    aux = []
    for c in range(6):
        aux.append(rd.randint(1, 100))
    m.append(aux)


for l in range(6):
     for c in range(6):
      print(f"{m[l][c]}", end = " ")
    
     print()

print("\n\n\n")


mi = []
for l in range(6):
 aux = []
 for c in range(6):
  aux.append(m[c][l])
 mi.append(aux)


for l in range(6):
 for c in range(6):
    print(f"{mi[l][c]}", end = " ")
 print()