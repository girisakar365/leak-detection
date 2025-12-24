import random
import numpy as np
import torch


def set_seed(seed):
    """
    Sets the random seed for all relevant libraries to ensure reproducible results.
    """
    random.seed(seed)  # Python's random module
    np.random.seed(seed)  # NumPy
    torch.manual_seed(seed)  # PyTorch CPU
    torch.cuda.manual_seed(seed)  # PyTorch GPU (single-GPU)
    torch.cuda.manual_seed_all(seed)  # PyTorch GPU (multi-GPU)
    torch.backends.cudnn.deterministic = True  # Enforce deterministic behavior in cuDNN
    torch.backends.cudnn.benchmark = False