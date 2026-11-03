from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_hit_custom_fields_additional_property_type_3 import IssueHitCustomFieldsAdditionalPropertyType3
  from ..models.issue_hit_custom_fields_additional_property_type_4_item import IssueHitCustomFieldsAdditionalPropertyType4Item
  from ..models.issue_hit_custom_fields_additional_property_type_5 import IssueHitCustomFieldsAdditionalPropertyType5
  from ..models.issue_hit_custom_fields_additional_property_type_6_item import IssueHitCustomFieldsAdditionalPropertyType6Item





T = TypeVar("T", bound="IssueHitCustomFields")



@_attrs_define
class IssueHitCustomFields:
    

    additional_properties: dict[str, bool | float | IssueHitCustomFieldsAdditionalPropertyType3 | IssueHitCustomFieldsAdditionalPropertyType5 | list[IssueHitCustomFieldsAdditionalPropertyType4Item] | list[IssueHitCustomFieldsAdditionalPropertyType6Item] | list[str] | str] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_hit_custom_fields_additional_property_type_3 import IssueHitCustomFieldsAdditionalPropertyType3 # noqa: PLC0415
        from ..models.issue_hit_custom_fields_additional_property_type_4_item import IssueHitCustomFieldsAdditionalPropertyType4Item # noqa: PLC0415
        from ..models.issue_hit_custom_fields_additional_property_type_5 import IssueHitCustomFieldsAdditionalPropertyType5 # noqa: PLC0415
        from ..models.issue_hit_custom_fields_additional_property_type_6_item import IssueHitCustomFieldsAdditionalPropertyType6Item # noqa: PLC0415
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            
            if isinstance(prop, IssueHitCustomFieldsAdditionalPropertyType3):
                field_dict[prop_name] = prop.to_dict()
            elif isinstance(prop, list):
                field_dict[prop_name] = []
                for additional_property_type_4_item_data in prop:
                    additional_property_type_4_item = additional_property_type_4_item_data.to_dict()
                    field_dict[prop_name].append(additional_property_type_4_item)


            elif isinstance(prop, IssueHitCustomFieldsAdditionalPropertyType5):
                field_dict[prop_name] = prop.to_dict()
            elif isinstance(prop, list):
                field_dict[prop_name] = []
                for additional_property_type_6_item_data in prop:
                    additional_property_type_6_item = additional_property_type_6_item_data.to_dict()
                    field_dict[prop_name].append(additional_property_type_6_item)


            elif isinstance(prop, list):
                field_dict[prop_name] = prop


            else:
                field_dict[prop_name] = prop


        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_hit_custom_fields_additional_property_type_3 import IssueHitCustomFieldsAdditionalPropertyType3 # noqa: PLC0415
        from ..models.issue_hit_custom_fields_additional_property_type_4_item import IssueHitCustomFieldsAdditionalPropertyType4Item # noqa: PLC0415
        from ..models.issue_hit_custom_fields_additional_property_type_5 import IssueHitCustomFieldsAdditionalPropertyType5 # noqa: PLC0415
        from ..models.issue_hit_custom_fields_additional_property_type_6_item import IssueHitCustomFieldsAdditionalPropertyType6Item # noqa: PLC0415
        d = dict(src_dict)
        issue_hit_custom_fields = cls(
        )


        additional_properties = {}
        for prop_name, prop_dict in d.items():
            def _parse_additional_property(data: object) -> bool | float | IssueHitCustomFieldsAdditionalPropertyType3 | IssueHitCustomFieldsAdditionalPropertyType5 | list[IssueHitCustomFieldsAdditionalPropertyType4Item] | list[IssueHitCustomFieldsAdditionalPropertyType6Item] | list[str] | str:
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    additional_property_type_3 = IssueHitCustomFieldsAdditionalPropertyType3.from_dict(data)



                    return additional_property_type_3
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, list):
                        raise TypeError()
                    additional_property_type_4 = []
                    _additional_property_type_4 = data
                    for additional_property_type_4_item_data in (_additional_property_type_4):
                        additional_property_type_4_item = IssueHitCustomFieldsAdditionalPropertyType4Item.from_dict(additional_property_type_4_item_data)



                        additional_property_type_4.append(additional_property_type_4_item)

                    return additional_property_type_4
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, dict):
                        raise TypeError()
                    additional_property_type_5 = IssueHitCustomFieldsAdditionalPropertyType5.from_dict(data)



                    return additional_property_type_5
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, list):
                        raise TypeError()
                    additional_property_type_6 = []
                    _additional_property_type_6 = data
                    for additional_property_type_6_item_data in (_additional_property_type_6):
                        additional_property_type_6_item = IssueHitCustomFieldsAdditionalPropertyType6Item.from_dict(additional_property_type_6_item_data)



                        additional_property_type_6.append(additional_property_type_6_item)

                    return additional_property_type_6
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                try:
                    if not isinstance(data, list):
                        raise TypeError()
                    additional_property_type_7 = cast(list[str], data)

                    return additional_property_type_7
                except (TypeError, ValueError, AttributeError, KeyError):
                    pass
                return cast(bool | float | IssueHitCustomFieldsAdditionalPropertyType3 | IssueHitCustomFieldsAdditionalPropertyType5 | list[IssueHitCustomFieldsAdditionalPropertyType4Item] | list[IssueHitCustomFieldsAdditionalPropertyType6Item] | list[str] | str, data)

            additional_property = _parse_additional_property(prop_dict)

            additional_properties[prop_name] = additional_property

        issue_hit_custom_fields.additional_properties = additional_properties
        return issue_hit_custom_fields

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> bool | float | IssueHitCustomFieldsAdditionalPropertyType3 | IssueHitCustomFieldsAdditionalPropertyType5 | list[IssueHitCustomFieldsAdditionalPropertyType4Item] | list[IssueHitCustomFieldsAdditionalPropertyType6Item] | list[str] | str:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: bool | float | IssueHitCustomFieldsAdditionalPropertyType3 | IssueHitCustomFieldsAdditionalPropertyType5 | list[IssueHitCustomFieldsAdditionalPropertyType4Item] | list[IssueHitCustomFieldsAdditionalPropertyType6Item] | list[str] | str) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
