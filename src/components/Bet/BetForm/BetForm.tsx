
interface Props {
    onRecipientChange: (recipient: string) => void;
    onSenderChange: (sender: string) => void;
    onAmountChange: (amount: number) => void;
    onDescriptionChange: (description: string) => void;
}

function BetForm({onAmountChange, onDescriptionChange, onSenderChange, onRecipientChange}: Props) {

    const handleRecipientChange = (evt: React.ChangeEvent<HTMLInputElement>): void => {
        onRecipientChange(evt.target.value);
        
    }

    const handleSenderChange = (evt: React.ChangeEvent<HTMLInputElement>): void => {
        onSenderChange(evt.target.value);
        
    }

    const handleAmountChange = (evt: React.ChangeEvent<HTMLInputElement>): void => {
        const numberValue: number = parseFloat(evt.target.value);

        if (typeof numberValue == 'number') {
            onAmountChange(numberValue);
        }
        
    }

    const handleDescriptionChange = (evt: React.ChangeEvent<HTMLTextAreaElement>): void => {
        onDescriptionChange(evt.target.value);
        
    }

    return (
        <>
        <div className="input-group mb-3">
            <span className="input-group-text" id="basic-addon1">Recipient</span>
            <input
            type="text"
            className="form-control"
            placeholder="Recipient email"
            aria-label="Recipient email"
            aria-describedby="basic-addon2"
            onChange = {handleRecipientChange}
            />
        </div>

        <div className="input-group mb-3">
            <span className="input-group-text" id="basic-addon1">Sender</span>
            <input
            type="text"
            className="form-control"
            placeholder="Sender email"
            aria-label="Sender email"
            aria-describedby="basic-addon2"
            onChange = {handleSenderChange}
            />
        </div>

        <div className="input-group mb-3">
            <span className="input-group-text">Amount ($)</span>
            <input
            type="text"
            className="form-control"
            aria-label="Amount (to the nearest dollar)"
            onChange = {handleAmountChange}
            />
        </div>

        <div className="input-group">
            <span className="input-group-text">Description</span>
            <textarea
            className="form-control"
            aria-label="With textarea"
            onChange = {handleDescriptionChange}
            ></textarea>
        </div>
        </>
    );
}

export default BetForm;
