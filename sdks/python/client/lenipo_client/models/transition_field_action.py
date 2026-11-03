from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.transition_field_action_action import TransitionFieldActionAction
from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="TransitionFieldAction")



@_attrs_define
class TransitionFieldAction:
    """ 
        Attributes:
            field (str):
            action (TransitionFieldActionAction):
            value (bool | float | list[UUID] | str | Unset):
     """

    field: str
    action: TransitionFieldActionAction
    value: bool | float | list[UUID] | str | Unset = UNSET





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

        action = TransitionFieldActionAction(d.pop("action"))




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


        transition_field_action = cls(
            field=field,
            action=action,
            value=value,
        )

        return transition_field_action

