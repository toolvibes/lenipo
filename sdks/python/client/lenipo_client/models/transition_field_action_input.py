from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.transition_field_action_input_action import TransitionFieldActionInputAction
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="TransitionFieldActionInput")



@_attrs_define
class TransitionFieldActionInput:
    """ 
        Attributes:
            field (str):
            action (TransitionFieldActionInputAction):
            value (bool | float | list[UUID] | str | Unset):
     """

    field: str
    action: TransitionFieldActionInputAction
    value: bool | float | list[UUID] | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        field = self.field

        action = self.action.value

        value: bool | float | list[str] | str | Unset
        if isinstance(self.value, Unset):
            value = UNSET
        elif isinstance(self.value, list):
            value = []
            for value_type_3_item_data in self.value:
                value_type_3_item = str(value_type_3_item_data)
                value.append(value_type_3_item)


        else:
            value = self.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "field": field,
            "action": action,
        })
        if value is not UNSET:
            field_dict["value"] = value

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        field = d.pop("field")

        action = TransitionFieldActionInputAction(d.pop("action"))




        def _parse_value(data: object) -> bool | float | list[UUID] | str | Unset:
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                value_type_3 = []
                _value_type_3 = data
                for value_type_3_item_data in (_value_type_3):
                    value_type_3_item = UUID(value_type_3_item_data)



                    value_type_3.append(value_type_3_item)

                return value_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(bool | float | list[UUID] | str | Unset, data)

        value = _parse_value(d.pop("value", UNSET))


        transition_field_action_input = cls(
            field=field,
            action=action,
            value=value,
        )


        transition_field_action_input.additional_properties = d
        return transition_field_action_input

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
