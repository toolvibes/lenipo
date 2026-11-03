from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigInputType1")



@_attrs_define
class GadgetConfigInputType1:
    """ 
        Attributes:
            type_ (Literal['assigned-to-me']):
            limit (int | Unset):  Default: 10.
     """

    type_: Literal['assigned-to-me']
    limit: int | Unset = 10
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        limit = self.limit


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
        })
        if limit is not UNSET:
            field_dict["limit"] = limit

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['assigned-to-me'] , d.pop("type"))
        if type_ != 'assigned-to-me':
            raise ValueError(f"type must match const 'assigned-to-me', got '{type_}'")

        limit = d.pop("limit", UNSET)

        gadget_config_input_type_1 = cls(
            type_=type_,
            limit=limit,
        )


        gadget_config_input_type_1.additional_properties = d
        return gadget_config_input_type_1

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
