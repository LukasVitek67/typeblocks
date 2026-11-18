export type Objednavka = {
    polozka: string;
    pocet: number;
    cenaZaKus: number;
    zaplaceno: boolean;
};

export function maNezaplacene(objednavky: Objednavka[]): boolean { //1. funkce
    return objednavky.some((objednavka) => !objednavka.zaplaceno);
}

export function cenyObjednavek(objednavky: Objednavka[]): number[] { //2. funkce
    return objednavky.map((objednavka) => objednavka.pocet * objednavka.cenaZaKus);
}

export function nezaplaceneObjednavky(objednavky: Objednavka[]): Objednavka[] { //3. funkce
    return objednavky.filter((objednavka) => !objednavka.zaplaceno);
}

export function zaplacenaTrzba(objednavky: Objednavka[]): number { //4. funkce
    return objednavky
        .filter((objednavka) => objednavka.zaplaceno)
        .reduce((celkem, objednavka) => celkem + objednavka.pocet * objednavka.cenaZaKus, 0);
}
