export type Friend = {
    name: string,
    bets: Bet[];
}

export type Bet = {
    name: string,
    amount: number;
    won: boolean;
}

const getTotalBets = (friend: Friend): number  => {

    let i = 0;

    for (const bet of friend.bets) {
        i++;
    }

    return i;
}