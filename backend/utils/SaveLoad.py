import torch
import os

def save_model_with_params(model, filepath, input_means=None, input_stds=None, output_means=None, output_stds=None):
    """
    Save the trained model along with normalization parameters to a file.

    Parameters:
    - model (torch.nn.Module): The PyTorch model to be saved.
    - filepath (str): The path where the model and parameters will be saved.
    - input_means (dict): Mean values of input features for normalization (optional).
    - input_stds (dict): Standard deviation values of input features for normalization (optional).
    - output_means (dict): Mean values of output features for normalization (optional).
    - output_stds (dict): Standard deviation values of output features for normalization (optional).
    """
    # Create a directory if it doesn't exist
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # Bundle model weights and normalization parameters into a dictionary
    checkpoint = {
        "model_state_dict": model.state_dict(),
        "input_means": input_means,
        "input_stds": input_stds,
        "output_means": output_means,
        "output_stds": output_stds,
    }

    # Save the checkpoint
    torch.save(checkpoint, filepath)
    print(f"Model and normalization parameters saved to {filepath}")


def load_model_with_params(model, filepath, device):
    """
    Load a trained model along with normalization parameters from a file.

    Parameters:
    - model (torch.nn.Module): The PyTorch model to which state_dict will be loaded.
    - filepath (str): The path to the saved model file.
    - device (torch.device): Device where the model should be loaded (CPU/GPU).

    Returns:
    - model (torch.nn.Module): The model with loaded weights.
    - normalization_params (dict): Dictionary containing normalization parameters.
    """
    # Load the checkpoint with weights_only=False (full checkpoint loading)
    checkpoint = torch.load(filepath, map_location=device, weights_only=False)

    # Load the model weights
    model.load_state_dict(checkpoint["model_state_dict"])

    # Extract normalization parameters
    normalization_params = {
        "input_means": checkpoint.get("input_means"),
        "input_stds": checkpoint.get("input_stds"),
        "output_means": checkpoint.get("output_means"),
        "output_stds": checkpoint.get("output_stds"),
    }

    return model, normalization_params