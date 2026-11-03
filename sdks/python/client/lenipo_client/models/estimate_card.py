from enum import StrEnum

class EstimateCard(StrEnum):
    COFFEE = "coffee"
    VALUE_0 = "0"
    VALUE_1 = "1"
    VALUE_10 = "0.5"
    VALUE_11 = "?"
    VALUE_2 = "2"
    VALUE_3 = "3"
    VALUE_4 = "5"
    VALUE_5 = "8"
    VALUE_6 = "13"
    VALUE_7 = "20"
    VALUE_8 = "40"
    VALUE_9 = "100"

    def __str__(self) -> str:
        return str(self.value)
