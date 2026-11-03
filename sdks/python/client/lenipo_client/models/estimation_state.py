from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.estimation import Estimation





T = TypeVar("T", bound="EstimationState")



@_attrs_define
class EstimationState:
    """ 
        Attributes:
            round_ (Estimation | None):
     """

    round_: Estimation | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.estimation import Estimation # noqa: PLC0415
        round_: dict[str, Any] | None
        if isinstance(self.round_, Estimation):
            round_ = self.round_.to_dict()
        else:
            round_ = self.round_


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "round": round_,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.estimation import Estimation # noqa: PLC0415
        d = dict(src_dict)
        def _parse_round_(data: object) -> Estimation | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                round_type_0 = Estimation.from_dict(data)



                return round_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(Estimation | None, data)

        round_ = _parse_round_(d.pop("round"))


        estimation_state = cls(
            round_=round_,
        )

        return estimation_state

