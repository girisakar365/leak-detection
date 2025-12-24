import csv
import os
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from .utils.Dataset import LeakDataset
from .utils.TrainValidate import train_model, validate_model
from .utils.SaveLoad import save_model_with_params
from .utils.Seed import set_seed


class LeakLocalizationNN(nn.Module):
    def __init__(self, input_dim, hidden_dims, output_dim=3):
        """
        Initialize the neural network.

        Parameters:
        - input_dim (int): Number of input features (size of the input vector).
        - hidden_dims (list of int): List containing the number of neurons in each hidden layer.
        - output_dim (int): Number of output variables. Default is 3 (X_coor, Y_coor, burst_size).
        """
        super(LeakLocalizationNN, self).__init__()
        self.input_dim = input_dim

        # Define the layers
        self.hidden_layers = nn.ModuleList()
        
        # Input to first hidden layer
        self.hidden_layers.append(nn.Linear(input_dim, hidden_dims[0]))

        # Subsequent hidden layers
        for i in range(len(hidden_dims) - 1):
            self.hidden_layers.append(nn.Linear(hidden_dims[i], hidden_dims[i + 1]))
        
        # Last layer (hidden to output)
        self.output_layer = nn.Linear(hidden_dims[-1], output_dim)

    def forward(self, x):
        # Forward pass through all hidden layers with ReLU activation
        for layer in self.hidden_layers:
            x = F.relu(layer(x))
        
        # Output layer (predict X_coor, Y_coor, burst_size)
        x = self.output_layer(x)
        return x

if __name__ == "__main__":
    seed = 42  # Set your seed value
    set_seed(seed)
    loss_log_path = "models/training_losses_run13.csv"

    # Create CSV file and write header if it doesn't exist
    if not os.path.exists(loss_log_path):
        with open(loss_log_path, mode="w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "epoch",
                "train_loss",
                "val_loss",
                "val_leak_x_loss_norm",
                "val_leak_y_loss_norm",
                "val_leak_size_loss_norm",
                "val_leak_x_loss_real",
                "val_leak_y_loss_real",
                "val_leak_size_loss_real"
            ])

    input_dim = 504  # Number of pressure head readings per input sample
    hidden_dims = [45, 40, 45]  # Custom hidden layers configuration
    output_dim = 3 
    model_save_path = "models/best_leak_localization_model_run13.pth"

    csv_file = "leak_data.csv"  # Path to your CSV file
    input_columns = ["Node1", "Node2", "Node3", "Node4", "Node5"]  # Define input columns
    output_columns = ["X_coor", "Y_coor", "burst_size"]  # Define output columns

    # Create dataset
    dataset = LeakDataset(csv_file, input_columns, output_columns)
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size

    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)

    # Initialize model, optimizer, and loss function
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LeakLocalizationNN(input_dim=input_dim, hidden_dims=hidden_dims, output_dim=output_dim)
    model.to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    criterion = nn.MSELoss()

    best_val_loss = float("inf")
    # Get the normalization parameters
    normalization_params = dataset.get_normalization_params()
    output_means = normalization_params["output_means"]
    output_stds = normalization_params["output_stds"]
    # Training loop
    num_epochs = 20
    for epoch in range(num_epochs):
        train_loss = train_model(model, train_loader, optimizer, criterion, device)
        val_loss, normalized_output_losses, denormalized_output_losses = validate_model(
            model, val_loader, criterion, device, output_means, output_stds
        )

        print(f"Epoch {epoch + 1}/{num_epochs}, Train Loss: {train_loss:.4f}, Validation Loss: {val_loss:.4f}")
        print("Validation Loss Breakdown (Normalized):", normalized_output_losses)
        print("Validation Loss Breakdown (Denormalized, Real Units):", denormalized_output_losses)
        print("_______________________________________________________________________________________")

        with open(loss_log_path, mode="a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                epoch + 1,
                train_loss,
                val_loss,
                normalized_output_losses["leak_x"],
                normalized_output_losses["leak_y"],
                normalized_output_losses["leak_size_lps"],
                denormalized_output_losses["leak_x"],
                denormalized_output_losses["leak_y"],
                denormalized_output_losses["leak_size_lps"],
            ])

        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            # Save the best model
            save_model_with_params(
                model=model,
                filepath=model_save_path,
                input_means=normalization_params["input_means"],
                input_stds=normalization_params["input_stds"],
                output_means=normalization_params["output_means"],
                output_stds=normalization_params["output_stds"],
            )
            print(f"Best model saved at epoch {epoch + 1} with validation loss: {best_val_loss:.4f}")
            print("---------------------------------------------------------------------------------------")