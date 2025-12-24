from pathlib import Path

import torch
import pandas as pd
from .utils.SaveLoad import load_model_with_params
from .Localization import LeakLocalizationNN

HOURLY_NODES = [
    'NODE_1383_Hour0', 'NODE_1383_Hour1', 'NODE_1383_Hour2', 'NODE_1383_Hour3', 'NODE_1383_Hour4', 'NODE_1383_Hour5', 'NODE_1383_Hour6', 'NODE_1383_Hour7', 'NODE_1383_Hour8', 'NODE_1383_Hour9', 'NODE_1383_Hour10', 'NODE_1383_Hour11', 'NODE_1383_Hour12', 'NODE_1383_Hour13', 'NODE_1383_Hour14', 'NODE_1383_Hour15', 'NODE_1383_Hour16', 'NODE_1383_Hour17', 'NODE_1383_Hour18', 'NODE_1383_Hour19', 'NODE_1383_Hour20', 'NODE_1383_Hour21', 'NODE_1383_Hour22', 'NODE_1383_Hour23', 'NODE_319_Hour0', 'NODE_319_Hour1', 'NODE_319_Hour2', 'NODE_319_Hour3', 'NODE_319_Hour4', 'NODE_319_Hour5', 'NODE_319_Hour6', 'NODE_319_Hour7', 'NODE_319_Hour8', 'NODE_319_Hour9', 'NODE_319_Hour10', 'NODE_319_Hour11', 'NODE_319_Hour12', 'NODE_319_Hour13', 'NODE_319_Hour14', 'NODE_319_Hour15', 'NODE_319_Hour16', 'NODE_319_Hour17', 'NODE_319_Hour18', 'NODE_319_Hour19', 'NODE_319_Hour20', 'NODE_319_Hour21', 'NODE_319_Hour22', 'NODE_319_Hour23', 'NODE_9014_Hour0', 'NODE_9014_Hour1', 'NODE_9014_Hour2', 'NODE_9014_Hour3', 'NODE_9014_Hour4', 'NODE_9014_Hour5', 'NODE_9014_Hour6', 'NODE_9014_Hour7', 'NODE_9014_Hour8', 'NODE_9014_Hour9', 'NODE_9014_Hour10', 'NODE_9014_Hour11', 'NODE_9014_Hour12', 'NODE_9014_Hour13', 'NODE_9014_Hour14', 'NODE_9014_Hour15', 'NODE_9014_Hour16', 'NODE_9014_Hour17', 'NODE_9014_Hour18', 'NODE_9014_Hour19', 'NODE_9014_Hour20', 'NODE_9014_Hour21', 'NODE_9014_Hour22', 'NODE_9014_Hour23', 'NODE_434_Hour0', 'NODE_434_Hour1', 'NODE_434_Hour2', 'NODE_434_Hour3', 'NODE_434_Hour4', 'NODE_434_Hour5', 'NODE_434_Hour6', 'NODE_434_Hour7', 'NODE_434_Hour8', 'NODE_434_Hour9', 'NODE_434_Hour10', 'NODE_434_Hour11', 'NODE_434_Hour12', 'NODE_434_Hour13', 'NODE_434_Hour14', 'NODE_434_Hour15', 'NODE_434_Hour16', 'NODE_434_Hour17', 'NODE_434_Hour18', 'NODE_434_Hour19', 'NODE_434_Hour20', 'NODE_434_Hour21', 'NODE_434_Hour22', 'NODE_434_Hour23', 'NODE_1119_Hour0', 'NODE_1119_Hour1', 'NODE_1119_Hour2', 'NODE_1119_Hour3', 'NODE_1119_Hour4', 'NODE_1119_Hour5', 'NODE_1119_Hour6', 'NODE_1119_Hour7', 'NODE_1119_Hour8', 'NODE_1119_Hour9', 'NODE_1119_Hour10', 'NODE_1119_Hour11', 'NODE_1119_Hour12', 'NODE_1119_Hour13', 'NODE_1119_Hour14', 'NODE_1119_Hour15', 'NODE_1119_Hour16', 'NODE_1119_Hour17', 'NODE_1119_Hour18', 'NODE_1119_Hour19', 'NODE_1119_Hour20', 'NODE_1119_Hour21', 'NODE_1119_Hour22', 'NODE_1119_Hour23', 'NODE_657_Hour0', 'NODE_657_Hour1', 'NODE_657_Hour2', 'NODE_657_Hour3', 'NODE_657_Hour4', 'NODE_657_Hour5', 'NODE_657_Hour6', 'NODE_657_Hour7', 'NODE_657_Hour8', 'NODE_657_Hour9', 'NODE_657_Hour10', 'NODE_657_Hour11', 'NODE_657_Hour12', 'NODE_657_Hour13', 'NODE_657_Hour14', 'NODE_657_Hour15', 'NODE_657_Hour16', 'NODE_657_Hour17', 'NODE_657_Hour18', 'NODE_657_Hour19', 'NODE_657_Hour20', 'NODE_657_Hour21', 'NODE_657_Hour22', 'NODE_657_Hour23', 'NODEIN_3801_Hour0', 'NODEIN_3801_Hour1', 'NODEIN_3801_Hour2', 'NODEIN_3801_Hour3', 'NODEIN_3801_Hour4', 'NODEIN_3801_Hour5', 'NODEIN_3801_Hour6', 'NODEIN_3801_Hour7', 'NODEIN_3801_Hour8', 'NODEIN_3801_Hour9', 'NODEIN_3801_Hour10', 'NODEIN_3801_Hour11', 'NODEIN_3801_Hour12', 'NODEIN_3801_Hour13', 'NODEIN_3801_Hour14', 'NODEIN_3801_Hour15', 'NODEIN_3801_Hour16', 'NODEIN_3801_Hour17', 'NODEIN_3801_Hour18', 'NODEIN_3801_Hour19', 'NODEIN_3801_Hour20', 'NODEIN_3801_Hour21', 'NODEIN_3801_Hour22', 'NODEIN_3801_Hour23', 'NODE_472_Hour0', 'NODE_472_Hour1', 'NODE_472_Hour2', 'NODE_472_Hour3', 'NODE_472_Hour4', 'NODE_472_Hour5', 'NODE_472_Hour6', 'NODE_472_Hour7', 'NODE_472_Hour8', 'NODE_472_Hour9', 'NODE_472_Hour10', 'NODE_472_Hour11', 'NODE_472_Hour12', 'NODE_472_Hour13', 'NODE_472_Hour14', 'NODE_472_Hour15', 'NODE_472_Hour16', 'NODE_472_Hour17', 'NODE_472_Hour18', 'NODE_472_Hour19', 'NODE_472_Hour20', 'NODE_472_Hour21', 'NODE_472_Hour22', 'NODE_472_Hour23', 'NODE_504_Hour0', 'NODE_504_Hour1', 'NODE_504_Hour2', 'NODE_504_Hour3', 'NODE_504_Hour4', 'NODE_504_Hour5', 'NODE_504_Hour6', 'NODE_504_Hour7', 'NODE_504_Hour8', 'NODE_504_Hour9', 'NODE_504_Hour10', 'NODE_504_Hour11', 'NODE_504_Hour12', 'NODE_504_Hour13', 'NODE_504_Hour14', 'NODE_504_Hour15', 'NODE_504_Hour16', 'NODE_504_Hour17', 'NODE_504_Hour18', 'NODE_504_Hour19', 'NODE_504_Hour20', 'NODE_504_Hour21', 'NODE_504_Hour22', 'NODE_504_Hour23', 'NODE_433_Hour0', 'NODE_433_Hour1', 'NODE_433_Hour2', 'NODE_433_Hour3', 'NODE_433_Hour4', 'NODE_433_Hour5', 'NODE_433_Hour6', 'NODE_433_Hour7', 'NODE_433_Hour8', 'NODE_433_Hour9', 'NODE_433_Hour10', 'NODE_433_Hour11', 'NODE_433_Hour12', 'NODE_433_Hour13', 'NODE_433_Hour14', 'NODE_433_Hour15', 'NODE_433_Hour16', 'NODE_433_Hour17', 'NODE_433_Hour18', 'NODE_433_Hour19', 'NODE_433_Hour20', 'NODE_433_Hour21', 'NODE_433_Hour22', 'NODE_433_Hour23', 'NODE_460_Hour0', 'NODE_460_Hour1', 'NODE_460_Hour2', 'NODE_460_Hour3', 'NODE_460_Hour4', 'NODE_460_Hour5', 'NODE_460_Hour6', 'NODE_460_Hour7', 'NODE_460_Hour8', 'NODE_460_Hour9', 'NODE_460_Hour10', 'NODE_460_Hour11', 'NODE_460_Hour12', 'NODE_460_Hour13', 'NODE_460_Hour14', 'NODE_460_Hour15', 'NODE_460_Hour16', 'NODE_460_Hour17', 'NODE_460_Hour18', 'NODE_460_Hour19', 'NODE_460_Hour20', 'NODE_460_Hour21', 'NODE_460_Hour22', 'NODE_460_Hour23', 'NODE_470_Hour0', 'NODE_470_Hour1', 'NODE_470_Hour2', 'NODE_470_Hour3', 'NODE_470_Hour4', 'NODE_470_Hour5', 'NODE_470_Hour6', 'NODE_470_Hour7', 'NODE_470_Hour8', 'NODE_470_Hour9', 'NODE_470_Hour10', 'NODE_470_Hour11', 'NODE_470_Hour12', 'NODE_470_Hour13', 'NODE_470_Hour14', 'NODE_470_Hour15', 'NODE_470_Hour16', 'NODE_470_Hour17', 'NODE_470_Hour18', 'NODE_470_Hour19', 'NODE_470_Hour20', 'NODE_470_Hour21', 'NODE_470_Hour22', 'NODE_470_Hour23', 'NODE_1185_Hour0', 'NODE_1185_Hour1', 'NODE_1185_Hour2', 'NODE_1185_Hour3', 'NODE_1185_Hour4', 'NODE_1185_Hour5', 'NODE_1185_Hour6', 'NODE_1185_Hour7', 'NODE_1185_Hour8', 'NODE_1185_Hour9', 'NODE_1185_Hour10', 'NODE_1185_Hour11', 'NODE_1185_Hour12', 'NODE_1185_Hour13', 'NODE_1185_Hour14', 'NODE_1185_Hour15', 'NODE_1185_Hour16', 'NODE_1185_Hour17', 'NODE_1185_Hour18', 'NODE_1185_Hour19', 'NODE_1185_Hour20', 'NODE_1185_Hour21', 'NODE_1185_Hour22', 'NODE_1185_Hour23', 'NODE_446_Hour0', 'NODE_446_Hour1', 'NODE_446_Hour2', 'NODE_446_Hour3', 'NODE_446_Hour4', 'NODE_446_Hour5', 'NODE_446_Hour6', 'NODE_446_Hour7', 'NODE_446_Hour8', 'NODE_446_Hour9', 'NODE_446_Hour10', 'NODE_446_Hour11', 'NODE_446_Hour12', 'NODE_446_Hour13', 'NODE_446_Hour14', 'NODE_446_Hour15', 'NODE_446_Hour16', 'NODE_446_Hour17', 'NODE_446_Hour18', 'NODE_446_Hour19', 'NODE_446_Hour20', 'NODE_446_Hour21', 'NODE_446_Hour22', 'NODE_446_Hour23', 'NODE_1433_Hour0', 'NODE_1433_Hour1', 'NODE_1433_Hour2', 'NODE_1433_Hour3', 'NODE_1433_Hour4', 'NODE_1433_Hour5', 'NODE_1433_Hour6', 'NODE_1433_Hour7', 'NODE_1433_Hour8', 'NODE_1433_Hour9', 'NODE_1433_Hour10', 'NODE_1433_Hour11', 'NODE_1433_Hour12', 'NODE_1433_Hour13', 'NODE_1433_Hour14', 'NODE_1433_Hour15', 'NODE_1433_Hour16', 'NODE_1433_Hour17', 'NODE_1433_Hour18', 'NODE_1433_Hour19', 'NODE_1433_Hour20', 'NODE_1433_Hour21', 'NODE_1433_Hour22', 'NODE_1433_Hour23', 'NODE_1124_Hour0', 'NODE_1124_Hour1', 'NODE_1124_Hour2', 'NODE_1124_Hour3', 'NODE_1124_Hour4', 'NODE_1124_Hour5', 'NODE_1124_Hour6', 'NODE_1124_Hour7', 'NODE_1124_Hour8', 'NODE_1124_Hour9', 'NODE_1124_Hour10', 'NODE_1124_Hour11', 'NODE_1124_Hour12', 'NODE_1124_Hour13', 'NODE_1124_Hour14', 'NODE_1124_Hour15', 'NODE_1124_Hour16', 'NODE_1124_Hour17', 'NODE_1124_Hour18', 'NODE_1124_Hour19', 'NODE_1124_Hour20', 'NODE_1124_Hour21', 'NODE_1124_Hour22', 'NODE_1124_Hour23', 'NODE_501_Hour0', 'NODE_501_Hour1', 'NODE_501_Hour2', 'NODE_501_Hour3', 'NODE_501_Hour4', 'NODE_501_Hour5', 'NODE_501_Hour6', 'NODE_501_Hour7', 'NODE_501_Hour8', 'NODE_501_Hour9', 'NODE_501_Hour10', 'NODE_501_Hour11', 'NODE_501_Hour12', 'NODE_501_Hour13', 'NODE_501_Hour14', 'NODE_501_Hour15', 'NODE_501_Hour16', 'NODE_501_Hour17', 'NODE_501_Hour18', 'NODE_501_Hour19', 'NODE_501_Hour20', 'NODE_501_Hour21', 'NODE_501_Hour22', 'NODE_501_Hour23', 'NODE_635_Hour0', 'NODE_635_Hour1', 'NODE_635_Hour2', 'NODE_635_Hour3', 'NODE_635_Hour4', 'NODE_635_Hour5', 'NODE_635_Hour6', 'NODE_635_Hour7', 'NODE_635_Hour8', 'NODE_635_Hour9', 'NODE_635_Hour10', 'NODE_635_Hour11', 'NODE_635_Hour12', 'NODE_635_Hour13', 'NODE_635_Hour14', 'NODE_635_Hour15', 'NODE_635_Hour16', 'NODE_635_Hour17', 'NODE_635_Hour18', 'NODE_635_Hour19', 'NODE_635_Hour20', 'NODE_635_Hour21', 'NODE_635_Hour22', 'NODE_635_Hour23', 'NODE_444_Hour0', 'NODE_444_Hour1', 'NODE_444_Hour2', 'NODE_444_Hour3', 'NODE_444_Hour4', 'NODE_444_Hour5', 'NODE_444_Hour6', 'NODE_444_Hour7', 'NODE_444_Hour8', 'NODE_444_Hour9', 'NODE_444_Hour10', 'NODE_444_Hour11', 'NODE_444_Hour12', 'NODE_444_Hour13', 'NODE_444_Hour14', 'NODE_444_Hour15', 'NODE_444_Hour16', 'NODE_444_Hour17', 'NODE_444_Hour18', 'NODE_444_Hour19', 'NODE_444_Hour20', 'NODE_444_Hour21', 'NODE_444_Hour22', 'NODE_444_Hour23', 'NODE_430_Hour0', 'NODE_430_Hour1', 'NODE_430_Hour2', 'NODE_430_Hour3', 'NODE_430_Hour4', 'NODE_430_Hour5', 'NODE_430_Hour6', 'NODE_430_Hour7', 'NODE_430_Hour8', 'NODE_430_Hour9', 'NODE_430_Hour10', 'NODE_430_Hour11', 'NODE_430_Hour12', 'NODE_430_Hour13', 'NODE_430_Hour14', 'NODE_430_Hour15', 'NODE_430_Hour16', 'NODE_430_Hour17', 'NODE_430_Hour18', 'NODE_430_Hour19', 'NODE_430_Hour20', 'NODE_430_Hour21', 'NODE_430_Hour22', 'NODE_430_Hour23', 'NODE_1162_Hour0', 'NODE_1162_Hour1', 'NODE_1162_Hour2', 'NODE_1162_Hour3', 'NODE_1162_Hour4', 'NODE_1162_Hour5', 'NODE_1162_Hour6', 'NODE_1162_Hour7', 'NODE_1162_Hour8', 'NODE_1162_Hour9', 'NODE_1162_Hour10', 'NODE_1162_Hour11', 'NODE_1162_Hour12', 'NODE_1162_Hour13', 'NODE_1162_Hour14', 'NODE_1162_Hour15', 'NODE_1162_Hour16', 'NODE_1162_Hour17', 'NODE_1162_Hour18', 'NODE_1162_Hour19', 'NODE_1162_Hour20', 'NODE_1162_Hour21', 'NODE_1162_Hour22', 'NODE_1162_Hour23'
]

class PredictLeakLocation:
    """
    Class to handle leak location prediction using a trained model.
    """

    def normalize_inputs(self, input_data, input_means, input_stds):
        """
        Normalize the input data using means and standard deviations.

        Parameters:
        - input_data (pd.DataFrame): DataFrame containing the input features.
        - input_means (dict): Mean values for input features.
        - input_stds (dict): Std deviation values for input features.

        Returns:
        - normalized_inputs (torch.Tensor): Normalized inputs as a PyTorch Tensor.
        """
        normalized_data = input_data.copy()
        for column in input_data.columns:
            if column in input_means and column in input_stds:
                normalized_data[column] = (input_data[column] - input_means[column]) / input_stds[column]
        return torch.tensor(normalized_data.values, dtype=torch.float32)


    def denormalize_outputs(self, predictions, output_means, output_stds):
        """
        Denormalize model predictions using means and standard deviations.

        Parameters:
        - predictions (torch.Tensor): Normalized predictions from the model.
        - output_means (dict): Mean values for output features.
        - output_stds (dict): Std deviation values for output features.

        Returns:
        - denormalized_data (pd.DataFrame): Denormalized predictions as a DataFrame.
        """
        denormalized_data = []
        for i, (key, mean) in enumerate(output_means.items()):
            std = output_stds[key]
            denormalized_predictions = predictions[:, i] * std + mean
            denormalized_data.append(denormalized_predictions.tolist())
        return {key: values for key, values in zip(output_means.keys(), denormalized_data)}


    def run_test_cases(self, model_path, test_csv, input_columns, device):
        """
        Run inference on test cases using the trained model.

        Parameters:
        - model_path (str): Path to the saved model and normalization parameters.
        - test_csv (str): Path to the test cases CSV file.
        - input_columns (list of str): List of input feature column names.

        Returns:
        - denormalized_predictions (pd.DataFrame): Denormalized model predictions.
        """
        # Load the test data
        test_data = pd.read_csv(test_csv)
        test_inputs = test_data[input_columns]

        # Load the trained model and normalization parameters
        model = LeakLocalizationNN(input_dim=len(input_columns), hidden_dims=[50, 50, 100, 70], output_dim=3)
        model, normalization_params = load_model_with_params(model, model_path, device)

        # Extract normalization parameters from the model
        input_means = normalization_params["input_means"]
        input_stds = normalization_params["input_stds"]
        output_means = normalization_params["output_means"]
        output_stds = normalization_params["output_stds"]

        # Normalize the inputs using saved means and stds
        normalized_inputs = self.normalize_inputs(test_inputs, input_means, input_stds).to(device)

        # Perform inference
        model.eval()
        with torch.no_grad():
            normalized_predictions = model(normalized_inputs)

        # Denormalize the predictions
        denormalized_predictions = self.denormalize_outputs(normalized_predictions, output_means, output_stds)
        return denormalized_predictions


    def get_data(self):
        main_path = Path(__file__).parent

            # Path to the saved model with normalization parameters
        model_path = main_path / "model" / "leak_model.pth"
        # Path to test cases CSV file
        test_csv = main_path / "generated_data.csv"  # Update this with the path to your test cases
        # Input configuration

        # Select device (CPU/GPU)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Run inference on test cases
        predictions = self.run_test_cases(model_path, test_csv, HOURLY_NODES, device)

        return predictions