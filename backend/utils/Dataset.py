import pandas as pd
import torch
from torch.utils.data import Dataset

class LeakDataset(Dataset):
    def __init__(self, csv_file, input_columns, output_columns, normalize=True, exclude=None):
        """
        Initializes the dataset from a CSV file with optional normalization.

        Parameters:
        - csv_file (str): Path to the CSV file.
        - input_columns (list of str): List of column names to use as inputs.
        - output_columns (list of str): List of column names to use as outputs.
        - normalize (bool): Whether or not to normalize the input and output data. Default is True.
        - exclude (list of str): List of column names (from input or output columns) to exclude from normalization.
        """
        # Load dataset
        data = pd.read_csv(csv_file)
        
        # Extract inputs (features) and outputs (targets)
        self.inputs = data[input_columns].copy()  # Copy input columns to avoid modifying original data
        self.outputs = data[output_columns].copy()  # Copy output columns to avoid modifying original data
        
        self.input_means = {}
        self.input_stds = {}
        self.output_means = {}
        self.output_stds = {}

        if normalize:
            # Normalize inputs
            for col in input_columns:
                if exclude and col in exclude:  # Skip excluded columns
                    continue
                col_mean = self.inputs[col].mean()
                col_std = self.inputs[col].std()
                self.input_means[col] = col_mean
                self.input_stds[col] = col_std
                self.inputs[col] = (self.inputs[col] - col_mean) / col_std

            # Normalize outputs
            for col in output_columns:
                if exclude and col in exclude:  # Skip excluded columns
                    continue
                col_mean = self.outputs[col].mean()
                col_std = self.outputs[col].std()
                self.output_means[col] = col_mean
                self.output_stds[col] = col_std
                self.outputs[col] = (self.outputs[col] - col_mean) / col_std

        # Convert to numpy arrays
        self.inputs = self.inputs.values  # Convert pandas DataFrame to numpy
        self.outputs = self.outputs.values  # Convert pandas DataFrame to numpy

        # Convert to PyTorch tensors
        self.inputs = torch.tensor(self.inputs, dtype=torch.float32)
        self.outputs = torch.tensor(self.outputs, dtype=torch.float32)

    def __len__(self):
        return len(self.inputs)

    def __getitem__(self, index):
        return self.inputs[index], self.outputs[index]

    def get_normalization_params(self):
        """
        Returns the normalization parameters.

        Returns:
        - dict: A dictionary containing means and standard deviations for inputs and outputs.
        """
        return {
            "input_means": self.input_means,
            "input_stds": self.input_stds,
            "output_means": self.output_means,
            "output_stds": self.output_stds,
        }