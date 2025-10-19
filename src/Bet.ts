
export type Bet = {
    id: number,
    sender: string,
    receiver: string,
    amount: number,
    description: string,
    status: 'pending' | 'accepted' | 'settled';

    payment? : {
        status: "winner" | "loser";
        transaction_id?: string | null;
    }
}